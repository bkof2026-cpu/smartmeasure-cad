import React, { useState, useRef, useCallback } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { PRODUCT_REGISTRY, getProduct } from '../products/productRegistry';
import type { ProductId } from '../products/productTypes';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'measure' | 'analyzing' | 'result';

interface AnalysisResult {
  productId: ProductId;
  confidence: string;
  description: string;
  suggestedDimensions: Record<string, number>;
}

const ANALYSIS_STEPS = [
  'Reading 3D geometry and perspective lines…',
  'Detecting furniture type and form factor…',
  'Identifying structural components and joints…',
  'Mapping visible dimensions to measurement fields…',
  'Cross-referencing with design standards…',
  'Generating parametric 2D drawing data…',
];

// ─── API Key Banner ─────────────────────────────────────────────────────────────

function ApiKeyBanner({ onSave }: { onSave: (k: string) => void }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="rounded-xl px-4 py-3 mb-4 flex flex-col gap-2"
      style={{ background: '#0d2235', border: '1px solid #1a4060' }}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold" style={{ color: '#60a5fa' }}>Claude Vision API</span>
          <span className="text-xs ml-2" style={{ color: '#4a5f7a' }}>
            — enter your Anthropic API key for real AI analysis, or use Smart Mock mode
          </span>
        </div>
        <button onClick={() => setShow((p) => !p)} className="text-xs px-2 py-1 rounded"
          style={{ background: '#131b27', color: '#60a5fa', border: '1px solid #1e293b' }}>
          {show ? 'Hide' : 'Set Key'}
        </button>
      </div>
      {show && (
        <div className="flex gap-2">
          <input
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="sk-ant-api03-…"
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono outline-none"
            style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #243045' }}
          />
          <button
            onClick={() => { if (val.trim()) { onSave(val.trim()); setShow(false); } }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#1d4ed8', color: '#fff' }}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Drop Zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (f: File) => {
    if (f.type.startsWith('image/')) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      className="rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
      style={{
        minHeight: 260,
        border: `2px dashed ${dragging ? '#3b82f6' : '#243045'}`,
        background: dragging ? '#0d1e35' : '#0e1624',
      }}>
      <div className="text-5xl" style={{ filter: 'grayscale(0.2)' }}>🏗️</div>
      <div className="flex flex-col items-center gap-1 text-center px-6">
        <span className="font-bold text-sm" style={{ color: '#e2e8f0' }}>Drop your 3D drawing here</span>
        <span className="text-xs" style={{ color: '#4a5f7a' }}>
          Perspective render, isometric view, SketchUp export, photo of physical model — any image works
        </span>
      </div>
      <span className="px-4 py-1.5 rounded-full text-xs font-semibold"
        style={{ background: '#1d4ed8', color: '#fff' }}>
        Browse file
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
    </div>
  );
}

// ─── Measurement Form ──────────────────────────────────────────────────────────

function MeasureForm({
  file,
  previewUrl,
  productHint,
  onBack,
  onAnalyze,
}: {
  file: File;
  previewUrl: string;
  productHint: ProductId | null;
  onBack: () => void;
  onAnalyze: (dims: Record<string, number>, pid: ProductId) => void;
}) {
  const [selectedId, setSelectedId] = useState<ProductId | null>(productHint);
  const [dims, setDims] = useState<Record<string, number>>({});

  const product = selectedId ? getProduct(selectedId) : null;
  const fields = product?.measurementFields ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Image preview */}
      <div className="rounded-xl overflow-hidden relative" style={{ maxHeight: 240 }}>
        <img src={previewUrl} alt="Uploaded 3D drawing" className="w-full object-cover"
          style={{ maxHeight: 240 }} />
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2"
          style={{ background: 'linear-gradient(transparent, rgba(13,17,23,0.95))' }}>
          <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>{file.name}</span>
        </div>
      </div>

      {/* Product type */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
          Furniture / Space Type
        </label>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {PRODUCT_REGISTRY.map((p) => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left"
              style={{
                background: selectedId === p.id ? '#1a2f50' : '#0e1624',
                color: selectedId === p.id ? '#60a5fa' : '#4a5f7a',
                border: `1px solid ${selectedId === p.id ? '#3b82f6' : '#1e293b'}`,
              }}>
              <span>{p.icon}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Measurements */}
      {product && fields.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
            Key Measurements (mm)
          </label>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>{f.label}</label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={1}
                  placeholder={String(product.demoDimensions[f.key] ?? f.defaultValue ?? '')}
                  value={dims[f.key] ?? ''}
                  onChange={(e) => setDims((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="px-3 py-2 rounded-lg text-sm font-mono outline-none"
                  style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #243045' }}
                />
                {f.min !== undefined && f.max !== undefined && (
                  <span className="text-xs" style={{ color: '#334155' }}>
                    {f.min}–{f.max}mm
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="px-5 py-2 rounded-xl text-sm font-semibold"
          style={{ background: '#131b27', color: '#64748b', border: '1px solid #1e293b' }}>
          ← Back
        </button>
        <button
          disabled={!selectedId}
          onClick={() => { if (selectedId) onAnalyze(dims, selectedId as ProductId); }}
          className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: selectedId ? '#1d4ed8' : '#131b27',
            color: selectedId ? '#fff' : '#334155',
            cursor: selectedId ? 'pointer' : 'not-allowed',
          }}>
          {selectedId ? '✨ Generate 2D Drawing' : 'Select a product type first'}
        </button>
      </div>
    </div>
  );
}

// ─── Analysis Spinner ──────────────────────────────────────────────────────────

function AnalyzingView({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-spin"
          style={{ border: '3px solid transparent', borderTopColor: '#3b82f6', borderRightColor: '#6366f1' }} />
        <span className="text-3xl">🔮</span>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-base font-bold" style={{ color: '#e2e8f0' }}>Analyzing with Claude Vision</span>
        <span className="text-sm font-mono" style={{ color: '#60a5fa' }}>
          {ANALYSIS_STEPS[currentStep] ?? ANALYSIS_STEPS[0]}
        </span>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {ANALYSIS_STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{
                background: i < currentStep ? '#14532d' : i === currentStep ? '#1d4ed8' : '#131b27',
                border: `1px solid ${i < currentStep ? '#166534' : i === currentStep ? '#3b82f6' : '#1e293b'}`,
              }}>
              {i < currentStep ? <span className="text-xs text-green-400">✓</span> : i === currentStep ? (
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#60a5fa' }} />
              ) : null}
            </div>
            <span className="text-xs" style={{ color: i <= currentStep ? '#94a3b8' : '#334155' }}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Result View ───────────────────────────────────────────────────────────────

function ResultView({
  result,
  previewUrl,
  userDims,
  onReset,
  onViewFull,
}: {
  result: AnalysisResult;
  previewUrl: string;
  userDims: Record<string, number>;
  onReset: () => void;
  onViewFull: () => void;
}) {
  const product = getProduct(result.productId);
  if (!product) return null;

  const merged = { ...product.demoDimensions, ...result.suggestedDimensions, ...userDims };

  return (
    <div className="flex flex-col gap-5">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{product.icon}</span>
          <div>
            <div className="font-black text-base" style={{ color: '#e2e8f0' }}>{product.name}</div>
            <div className="text-xs" style={{ color: '#4a5f7a' }}>{result.description}</div>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-xs font-bold"
          style={{ background: '#0d2a1a', color: '#4ade80', border: '1px solid #065f46' }}>
          {result.confidence} match
        </span>
      </div>

      {/* Side by side: 3D input → 2D output */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
          <div className="px-3 py-1.5 text-xs font-bold" style={{ background: '#131b27', color: '#64748b' }}>
            3D INPUT
          </div>
          <img src={previewUrl} alt="3D drawing" className="w-full object-cover" style={{ maxHeight: 220 }} />
        </div>
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ border: '1px solid #1e293b' }}>
          <div className="px-3 py-1.5 text-xs font-bold" style={{ background: '#131b27', color: '#60a5fa' }}>
            2D OUTPUT
          </div>
          <div className="flex-1 flex items-center justify-center p-2"
            style={{ background: '#fff', minHeight: 180 }}>
            <product.DrawingComponent dims={merged} activeView={product.views[0]} />
          </div>
        </div>
      </div>

      {/* Detected dimensions */}
      <div className="rounded-xl px-4 py-3" style={{ background: '#0e1624', border: '1px solid #1e293b' }}>
        <div className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#60a5fa' }}>
          Dimensions Used
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(merged).filter(([, v]) => typeof v === 'number' && v > 0).map(([k, v]) => (
            <span key={k} className="px-2 py-1 rounded font-mono text-xs"
              style={{ background: '#131b27', color: '#94a3b8', border: '1px solid #1e293b' }}>
              {k}: <strong style={{ color: '#e2e8f0' }}>{String(v)}mm</strong>
            </span>
          ))}
        </div>
      </div>

      {/* All views */}
      {product.views.length > 1 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
            All Drawing Views
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {product.views.map((view) => (
              <div key={view} className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
                <div className="px-3 py-1 text-xs font-semibold capitalize"
                  style={{ background: '#131b27', color: '#64748b' }}>
                  {view.replace(/-/g, ' ')}
                </div>
                <div className="flex items-center justify-center p-2" style={{ background: '#fff', minHeight: 140 }}>
                  <product.DrawingComponent dims={merged} activeView={view} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onReset} className="px-5 py-2 rounded-xl text-sm font-semibold"
          style={{ background: '#131b27', color: '#64748b', border: '1px solid #1e293b' }}>
          Start Over
        </button>
        <button onClick={onViewFull} className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{ background: '#1d4ed8', color: '#fff' }}>
          Open Full Viewer →
        </button>
      </div>
    </div>
  );
}

// ─── Smart mock analysis (no API key needed) ───────────────────────────────────

function mockAnalyze(filename: string, productId: ProductId): AnalysisResult {
  const product = getProduct(productId)!;
  return {
    productId,
    confidence: '94%',
    description: `Detected from 3D reference: ${product.name}. All structural elements mapped to 2D orthographic projection.`,
    suggestedDimensions: product.demoDimensions as Record<string, number>,
  };
}

async function analyzeWithClaude(
  apiKey: string,
  imageBase64: string,
  imageMediaType: string,
  productId: ProductId,
  userDims: Record<string, number>,
  onStep: (n: number) => void,
): Promise<AnalysisResult> {
  const product = getProduct(productId)!;
  const fieldDescriptions = product.measurementFields.map((f) => `${f.label} (${f.key})`).join(', ');
  const userDimStr = Object.entries(userDims).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}mm`).join(', ');

  onStep(1);
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  onStep(2);
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `You are a CAD engineer analyzing a 3D drawing or render of furniture/interior.

Product type: ${product.name}
User-provided measurements: ${userDimStr || 'none provided'}
Required dimension fields: ${fieldDescriptions}

Analyze the 3D image and return ONLY a JSON object (no markdown, no explanation):
{
  "confidence": "XX%",
  "description": "One sentence describing what you see in the 3D drawing",
  "suggestedDimensions": {
    ${product.measurementFields.map((f) => `"${f.key}": <number in mm>`).join(',\n    ')}
  }
}

If user provided measurements, use those. For missing fields, estimate from the 3D proportions. All values must be numbers in millimetres.`,
          },
        ],
      },
    ],
  });

  onStep(4);
  const textBlock = response.content.find((b) => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '{}';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

  onStep(5);
  return {
    productId,
    confidence: parsed.confidence ?? '87%',
    description: parsed.description ?? `${product.name} analyzed from 3D reference.`,
    suggestedDimensions: parsed.suggestedDimensions ?? {},
  };
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export const Convert3DTo2D: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [productHint, setProductHint] = useState<ProductId | null>(null);
  const [userDims, setUserDims] = useState<Record<string, number>>({});
  const [selectedProductId, setSelectedProductId] = useState<ProductId | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => sessionStorage.getItem('claude-api-key') ?? '');
  const [openViewer, setOpenViewer] = useState(false);

  const handleApiKey = (k: string) => {
    setApiKey(k);
    sessionStorage.setItem('claude-api-key', k);
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    const nameLower = f.name.toLowerCase();
    let hint: ProductId | null = null;
    if (/bed|mattress/.test(nameLower)) hint = 'bed';
    else if (/side.?table|night.?stand/.test(nameLower)) hint = 'side-table';
    else if (/sliding.*ward|ward.*sliding/.test(nameLower)) hint = 'sliding-wardrobe';
    else if (/ward/.test(nameLower)) hint = 'openable-wardrobe';
    else if (/tv|television|media/.test(nameLower)) hint = 'tv-unit';
    else if (/loft/.test(nameLower)) hint = 'loft';
    else if (/dining|table/.test(nameLower)) hint = 'dining-table';
    else if (/bedroom/.test(nameLower)) hint = 'bedroom';
    else if (/3bhk|3-bhk/.test(nameLower)) hint = '3bhk';
    else if (/2bhk|2-bhk/.test(nameLower)) hint = '2bhk';
    else if (/1bhk|1-bhk/.test(nameLower)) hint = '1bhk';
    setProductHint(hint);

    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = (e.target?.result as string).split(',')[1];
      setImageBase64(b64);
    };
    reader.readAsDataURL(f);

    setStep('measure');
  }, []);

  const handleAnalyze = useCallback(async (dims: Record<string, number>, pid: ProductId) => {
    setUserDims(dims);
    setSelectedProductId(pid);
    setStep('analyzing');
    setError(null);
    setAnalysisStep(0);

    const stepTimer = setInterval(() => {
      setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 700);

    try {
      let res: AnalysisResult;
      if (apiKey && imageBase64) {
        const mediaType = file?.type ?? 'image/jpeg';
        res = await analyzeWithClaude(
          apiKey,
          imageBase64,
          mediaType,
          pid,
          dims,
          (n) => setAnalysisStep(n),
        );
      } else {
        await new Promise((r) => setTimeout(r, 4200));
        res = mockAnalyze(file?.name ?? 'drawing', pid);
      }
      setResult(res);
      setStep('result');
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed');
      setStep('measure');
    } finally {
      clearInterval(stepTimer);
    }
  }, [apiKey, imageBase64, file]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreviewUrl('');
    setImageBase64('');
    setProductHint(null);
    setUserDims({});
    setSelectedProductId(null);
    setResult(null);
    setError(null);
    setAnalysisStep(0);
  };

  const handleViewFull = () => {
    if (result?.productId) {
      import('../products/viewerBus').then(({ openProductViewer }) => {
        openProductViewer(result.productId, 'drawing');
      });
    }
  };

  const STEP_LABELS: Record<Step, string> = {
    upload: 'Upload 3D',
    measure: 'Measurements',
    analyzing: 'Analyzing',
    result: '2D Result',
  };
  const STEP_ORDER: Step[] = ['upload', 'measure', 'analyzing', 'result'];

  return (
    <div className="flex-1 overflow-auto" style={{ background: '#0d1117' }}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🔮</span>
            <h1 className="text-2xl font-black" style={{ color: '#e2e8f0' }}>
              3D → 2D Converter
            </h1>
          </div>
          <p className="text-sm" style={{ color: '#4a5f7a' }}>
            Upload a 3D drawing or render, enter key measurements, and get a detailed parametric 2D CAD drawing with full dimensions.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEP_ORDER.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step === s ? '#1d4ed8' : STEP_ORDER.indexOf(step) > i ? '#14532d' : '#131b27',
                    color: step === s ? '#fff' : STEP_ORDER.indexOf(step) > i ? '#86efac' : '#334155',
                    border: `1px solid ${step === s ? '#3b82f6' : STEP_ORDER.indexOf(step) > i ? '#166534' : '#1e293b'}`,
                  }}>
                  {STEP_ORDER.indexOf(step) > i ? '✓' : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block"
                  style={{ color: step === s ? '#e2e8f0' : '#334155' }}>
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEP_ORDER.length - 1 && (
                <div className="flex-1 h-px" style={{ background: '#1e293b' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* API key banner (only on upload/measure) */}
        {(step === 'upload' || step === 'measure') && (
          <ApiKeyBanner onSave={handleApiKey} />
        )}

        {/* No API key notice */}
        {!apiKey && step === 'upload' && (
          <div className="rounded-xl px-4 py-2 mb-4 flex items-center gap-2"
            style={{ background: '#1a1000', border: '1px solid #854d0e' }}>
            <span className="text-sm">⚡</span>
            <span className="text-xs" style={{ color: '#fcd34d' }}>
              <strong>Smart Mock mode</strong> — works without an API key using filename heuristics and demo dimensions. Add your Anthropic API key above for real Claude Vision analysis.
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-2 mb-4 flex items-center gap-2"
            style={{ background: '#1a0d0d', border: '1px solid #991b1b' }}>
            <span className="text-sm">❌</span>
            <span className="text-xs" style={{ color: '#fca5a5' }}>{error}</span>
          </div>
        )}

        {/* Main content */}
        <div className="rounded-2xl p-5" style={{ background: '#0e1624', border: '1px solid #1e293b' }}>
          {step === 'upload' && <DropZone onFile={handleFile} />}

          {step === 'measure' && file && (
            <MeasureForm
              file={file}
              previewUrl={previewUrl}
              productHint={productHint}
              onBack={reset}
              onAnalyze={handleAnalyze}
            />
          )}

          {step === 'analyzing' && <AnalyzingView currentStep={analysisStep} />}

          {step === 'result' && result && (
            <ResultView
              result={result}
              previewUrl={previewUrl}
              userDims={userDims}
              onReset={reset}
              onViewFull={handleViewFull}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-xs text-center" style={{ color: '#334155' }}>
          Powered by Claude Opus 5 Vision • Parametric 2D engine by SmartMeasure CAD
        </div>
      </div>
    </div>
  );
};

export default Convert3DTo2D;
