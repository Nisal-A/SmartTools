import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  Eye,
  FilePlus2,
  History,
  Loader2,
  PenLine,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { getMyProfilesApi } from '../../services/profiles.api.js';
import {
  PROPOSAL_CURRENCIES,
  PROPOSAL_STATUSES,
  PROPOSAL_TONES,
  QUOTATION_HANDOFF_STORAGE_KEY,
  createProposalApi,
  deleteProposalApi,
  generateProposalApi,
  getMyProposalsApi,
  getProposalByIdApi,
  updateProposalApi,
} from '../../services/proposals.api.js';
import { ProposalAuthGate } from './ProposalAuthGate.jsx';
import {
  ProposalPrintDocument,
  computeProposalTotal,
} from './ProposalPrintDocument.jsx';
import { SavedProposalsDrawer } from './SavedProposalsDrawer.jsx';

function createInitialProposalForm(defaultCurrency = 'LKR') {
  return {
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    projectTitle: '',
    currency: defaultCurrency || 'LKR',
    tone: 'Professional',
    budgetHint: '',
    timelineHint: '',
    brief: '',
    status: 'Draft',
    sections: {
      executiveSummary: '',
      problemStatement: '',
      proposedSolution: '',
      deliverables: [''],
      timeline: [{ phase: 'Phase 1', duration: '2 Weeks', summary: '' }],
      termsAndNextSteps: '',
    },
    suggestedLineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
  };
}

function mapDocToForm(doc) {
  return {
    clientName: doc.clientName || '',
    clientCompany: doc.clientCompany || '',
    clientEmail: doc.clientEmail || '',
    projectTitle: doc.projectTitle || '',
    currency: doc.currency || 'LKR',
    tone: doc.tone || 'Professional',
    budgetHint: '',
    timelineHint: '',
    brief: doc.brief || '',
    status: doc.status || 'Draft',
    sections: {
      executiveSummary: doc.sections?.executiveSummary || '',
      problemStatement: doc.sections?.problemStatement || '',
      proposedSolution: doc.sections?.proposedSolution || '',
      deliverables:
        Array.isArray(doc.sections?.deliverables) &&
        doc.sections.deliverables.length > 0
          ? [...doc.sections.deliverables]
          : [''],
      timeline:
        Array.isArray(doc.sections?.timeline) && doc.sections.timeline.length > 0
          ? doc.sections.timeline.map((t) => ({
              phase: t.phase || '',
              duration: t.duration || '',
              summary: t.summary || '',
            }))
          : [{ phase: 'Phase 1', duration: '2 Weeks', summary: '' }],
      termsAndNextSteps: doc.sections?.termsAndNextSteps || '',
    },
    suggestedLineItems:
      Array.isArray(doc.suggestedLineItems) && doc.suggestedLineItems.length > 0
        ? doc.suggestedLineItems.map((it) => ({
            description: it.description || '',
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
          }))
        : [{ description: '', quantity: 1, unitPrice: 0 }],
  };
}

function buildPersistencePayload(form, statusOverride = null) {
  return {
    clientName: form.clientName.trim(),
    clientCompany: form.clientCompany.trim(),
    clientEmail: form.clientEmail.trim(),
    projectTitle: form.projectTitle.trim(),
    brief: form.brief.trim(),
    tone: form.tone,
    currency: form.currency,
    status: statusOverride || form.status || 'Draft',
    sections: {
      executiveSummary: form.sections.executiveSummary.trim(),
      problemStatement: form.sections.problemStatement.trim(),
      proposedSolution: form.sections.proposedSolution.trim(),
      deliverables: form.sections.deliverables
        .map((d) => String(d || '').trim())
        .filter(Boolean),
      timeline: form.sections.timeline
        .map((t) => ({
          phase: String(t.phase || '').trim(),
          duration: String(t.duration || '').trim(),
          summary: String(t.summary || '').trim(),
        }))
        .filter((t) => t.phase || t.duration || t.summary),
      termsAndNextSteps: form.sections.termsAndNextSteps.trim(),
    },
    suggestedLineItems: form.suggestedLineItems
      .map((item) => ({
        description: String(item.description || '').trim(),
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        unitPrice: Number(item.unitPrice) >= 0 ? Number(item.unitPrice) : 0,
      }))
      .filter((item) => item.description),
  };
}

function AiGenerationSkeleton() {
  return (
    <div
      className="space-y-4 rounded-2xl border border-violet-200 bg-white p-6 shadow-sm"
      data-testid="ai-proposal-loading-skeleton"
    >
      <div className="flex items-center gap-2.5 text-sm font-bold text-violet-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        Drafting structured sections, milestones, and pricing breakdown with AI…
      </div>
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="h-20 w-full rounded-xl bg-slate-100" />
        <div className="h-4 w-1/4 rounded bg-slate-200" />
        <div className="h-24 w-full rounded-xl bg-slate-100" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-16 rounded-xl bg-slate-100" />
          <div className="h-16 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function AiProposalWriterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, showToast } = useAuth();

  const [form, setForm] = useState(() => createInitialProposalForm('LKR'));
  const [savedProposal, setSavedProposal] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [loadingSavedList, setLoadingSavedList] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [workspaceUnlocked, setWorkspaceUnlocked] = useState(false);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview'
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const estimatedTotal = useMemo(
    () => computeProposalTotal(form.suggestedLineItems),
    [form.suggestedLineItems]
  );

  const refreshSavedProposals = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingSavedList(true);
    try {
      const list = await getMyProposalsApi();
      setSavedList(Array.isArray(list) ? list : []);
    } catch {
      // Keep current list on transient failure
    } finally {
      setLoadingSavedList(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;

    getMyProfilesApi()
      .then((profiles) => {
        if (cancelled) return;
        const biz = profiles?.businessProfile || null;
        setBusinessProfile(biz);
        if (!id && !savedProposal && biz?.defaultCurrency) {
          setForm((prev) => ({
            ...prev,
            currency: String(biz.defaultCurrency).toUpperCase(),
          }));
        }
      })
      .catch(() => {});

    refreshSavedProposals();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, id, savedProposal, refreshSavedProposals]);

  useEffect(() => {
    if (!isAuthenticated || !id) return undefined;
    let cancelled = false;
    setErrorMessage('');

    getProposalByIdApi(id)
      .then((doc) => {
        if (cancelled || !doc) return;
        setSavedProposal(doc);
        setForm(mapDocToForm(doc));
        setWorkspaceUnlocked(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(
            err.response?.data?.message || 'Unable to load the selected proposal.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, id]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateSectionField = (sectionKey, value) => {
    setForm((prev) => ({
      ...prev,
      sections: { ...prev.sections, [sectionKey]: value },
    }));
  };

  const handleGenerateWithAi = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!form.clientName.trim() || !form.projectTitle.trim()) {
      setErrorMessage('Client Name and Project Title are required.');
      return;
    }
    if (form.brief.trim().length < 10) {
      setErrorMessage('Please enter a project brief of at least 10 characters.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateProposalApi({
        clientName: form.clientName.trim(),
        clientCompany: form.clientCompany.trim(),
        projectTitle: form.projectTitle.trim(),
        brief: form.brief.trim(),
        budgetHint: form.budgetHint.trim(),
        timelineHint: form.timelineHint.trim(),
        currency: form.currency,
        tone: form.tone,
      });

      setForm((prev) => ({
        ...prev,
        sections: {
          executiveSummary: result.sections?.executiveSummary || '',
          problemStatement: result.sections?.problemStatement || '',
          proposedSolution: result.sections?.proposedSolution || '',
          deliverables:
            Array.isArray(result.sections?.deliverables) &&
            result.sections.deliverables.length > 0
              ? result.sections.deliverables
              : [''],
          timeline:
            Array.isArray(result.sections?.timeline) &&
            result.sections.timeline.length > 0
              ? result.sections.timeline
              : [{ phase: 'Phase 1', duration: '2 Weeks', summary: '' }],
          termsAndNextSteps: result.sections?.termsAndNextSteps || '',
        },
        suggestedLineItems:
          Array.isArray(result.suggestedLineItems) &&
          result.suggestedLineItems.length > 0
            ? result.suggestedLineItems
            : [{ description: '', quantity: 1, unitPrice: 0 }],
      }));
      setWorkspaceUnlocked(true);
      setViewMode('edit');
      showToast?.('AI proposal draft generated! Review and edit any section below.', 'success');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Failed to generate AI proposal.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveProposal = async () => {
    setErrorMessage('');
    if (!form.clientName.trim() || !form.projectTitle.trim() || form.brief.trim().length < 10) {
      setErrorMessage(
        'Client Name, Project Title, and a Brief (at least 10 characters) are required to save.'
      );
      return null;
    }

    setIsSaving(true);
    try {
      const payload = buildPersistencePayload(form);
      const saved = savedProposal?._id
        ? await updateProposalApi(savedProposal._id, payload)
        : await createProposalApi(payload);

      setSavedProposal(saved);
      setForm(mapDocToForm(saved));
      await refreshSavedProposals();
      showToast?.(
        `Proposal ${saved.proposalNumber || ''} saved successfully.`,
        'success'
      );
      return saved;
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to save proposal.'
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleHandOffToQuotation = async () => {
    setErrorMessage('');
    setIsHandingOff(true);

    try {
      let currentSaved = savedProposal;
      if (currentSaved?._id) {
        const updated = await updateProposalApi(
          currentSaved._id,
          buildPersistencePayload(form, 'Handed Off')
        );
        currentSaved = updated;
        setSavedProposal(updated);
        setForm(mapDocToForm(updated));
        refreshSavedProposals();
      }

      const handoffNotes = [
        `Proposal: ${form.projectTitle.trim() || 'Project Scope'}${
          currentSaved?.proposalNumber ? ` (${currentSaved.proposalNumber})` : ''
        }`,
        form.sections.executiveSummary?.trim(),
        form.sections.termsAndNextSteps?.trim()
          ? `Terms & Next Steps:\n${form.sections.termsAndNextSteps.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const handoffData = {
        sourceProposalId: currentSaved?._id || null,
        proposalNumber: currentSaved?.proposalNumber || '',
        projectTitle: form.projectTitle.trim() || 'AI Proposal',
        currency: form.currency || 'LKR',
        client: {
          name: form.clientName.trim(),
          companyName: form.clientCompany.trim(),
          email: form.clientEmail.trim(),
        },
        notes: handoffNotes,
        items: form.suggestedLineItems
          .map((item) => ({
            description: String(item.description || '').trim(),
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
            unitPrice: Number(item.unitPrice) >= 0 ? Number(item.unitPrice) : 0,
          }))
          .filter((item) => item.description),
      };

      try {
        window.sessionStorage.setItem(
          QUOTATION_HANDOFF_STORAGE_KEY,
          JSON.stringify(handoffData)
        );
      } catch {
        // Ignore sessionStorage quota issues; React Router state also carries handoffData
      }

      navigate('/tools/quotation-generator', {
        state: { handoffData },
      });
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Failed to hand off proposal to Quotation Generator.'
      );
    } finally {
      setIsHandingOff(false);
    }
  };

  const handleLoadProposal = (doc) => {
    setSavedProposal(doc);
    setForm(mapDocToForm(doc));
    setWorkspaceUnlocked(true);
    setViewMode('edit');
    setErrorMessage('');
  };

  const handleDeleteProposal = async (targetId) => {
    await deleteProposalApi(targetId);
    setSavedList((prev) => prev.filter((item) => item._id !== targetId));
    if (savedProposal?._id === targetId) {
      setSavedProposal(null);
      setForm(createInitialProposalForm(businessProfile?.defaultCurrency || 'LKR'));
      setWorkspaceUnlocked(false);
    }
    showToast?.('Proposal deleted.', 'success');
  };

  const handleNewDraft = () => {
    setSavedProposal(null);
    setForm(createInitialProposalForm(businessProfile?.defaultCurrency || 'LKR'));
    setWorkspaceUnlocked(false);
    setViewMode('edit');
    setErrorMessage('');
    if (id) {
      navigate('/tools/ai-proposal-writer');
    }
  };

  const handlePrintPdf = () => {
    const prevMode = viewMode;
    if (prevMode !== 'preview') {
      setViewMode('preview');
      window.setTimeout(() => window.print(), 80);
    } else {
      window.print();
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center gap-2 text-sm font-medium text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
        Loading AI Proposal Writer…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <ProposalAuthGate />;
  }

  return (
    <div className="space-y-6" data-testid="ai-proposal-writer-page">
      {/* Header Bar */}
      <section className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-600">
                <Bot className="h-4 w-4" /> AI Productivity
              </span>
              {savedProposal?.proposalNumber && (
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200">
                  {savedProposal.proposalNumber} · {form.status}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              AI Proposal Writer
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Turn a short brief into an editable structured client proposal and hand off line items
              to the Quotation Generator in one click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              data-testid="open-saved-proposals-btn"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <History className="h-4 w-4 text-slate-500" />
              Saved Proposals ({savedList.length})
            </button>

            <button
              type="button"
              onClick={handleNewDraft}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <FilePlus2 className="h-4 w-4 text-slate-500" />
              New Brief
            </button>

            {workspaceUnlocked && (
              <>
                <button
                  type="button"
                  onClick={() => setViewMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  {viewMode === 'edit' ? (
                    <>
                      <Eye className="h-4 w-4 text-slate-500" /> Client Print View
                    </>
                  ) : (
                    <>
                      <PenLine className="h-4 w-4 text-slate-500" /> Edit Sections
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrintPdf}
                  data-testid="print-proposal-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  Export / Print PDF
                </button>

                <button
                  type="button"
                  onClick={handleSaveProposal}
                  disabled={isSaving}
                  data-testid="save-proposal-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? 'Saving…' : savedProposal?._id ? 'Update Proposal' : 'Save Proposal'}
                </button>

                <button
                  type="button"
                  onClick={handleHandOffToQuotation}
                  disabled={isHandingOff}
                  data-testid="handoff-to-quotation-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isHandingOff ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4" />
                  )}
                  Hand Off to Quotation Generator
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {errorMessage && (
        <div
          role="alert"
          className="no-print flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Split / Stacked Workspace */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Step 1: Brief Input Panel */}
        <section
          className={`no-print space-y-4 ${
            workspaceUnlocked ? 'xl:col-span-4' : 'xl:col-span-12'
          }`}
          data-testid="proposal-brief-panel"
        >
          <form
            onSubmit={handleGenerateWithAi}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                  Step 1
                </span>
                <h2 className="text-base font-extrabold text-slate-900">
                  Client Brief &amp; Context
                </h2>
              </div>
              {!workspaceUnlocked && (
                <button
                  type="button"
                  onClick={() => setWorkspaceUnlocked(true)}
                  className="text-xs font-semibold text-slate-500 underline hover:text-slate-800"
                >
                  Open Manual Editor
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Client Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.clientName}
                  onChange={(e) => updateField('clientName', e.target.value)}
                  placeholder="e.g., Ruwan Silva"
                  data-testid="proposal-client-name-input"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Client Company
                </label>
                <input
                  type="text"
                  value={form.clientCompany}
                  onChange={(e) => updateField('clientCompany', e.target.value)}
                  placeholder="e.g., Lanka Retail Group"
                  data-testid="proposal-client-company-input"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Client Email
                </label>
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={(e) => updateField('clientEmail', e.target.value)}
                  placeholder="client@company.com"
                  data-testid="proposal-client-email-input"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Project Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.projectTitle}
                  onChange={(e) => updateField('projectTitle', e.target.value)}
                  placeholder="e.g., E-Commerce Platform Redesign"
                  data-testid="proposal-project-title-input"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  data-testid="proposal-currency-select"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-violet-400 focus:outline-none"
                >
                  {PROPOSAL_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Proposal Tone
                </label>
                <select
                  value={form.tone}
                  onChange={(e) => updateField('tone', e.target.value)}
                  data-testid="proposal-tone-select"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-violet-400 focus:outline-none"
                >
                  {PROPOSAL_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Budget Hint (Optional)
                </label>
                <input
                  type="text"
                  value={form.budgetHint}
                  onChange={(e) => updateField('budgetHint', e.target.value)}
                  placeholder="e.g., LKR 450,000"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Timeline Hint (Optional)
                </label>
                <input
                  type="text"
                  value={form.timelineHint}
                  onChange={(e) => updateField('timelineHint', e.target.value)}
                  placeholder="e.g., 6 Weeks"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Project Brief <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={form.brief}
                onChange={(e) => updateField('brief', e.target.value)}
                placeholder="Describe client goals, pain points, required features, or integrations (min 10 chars)…"
                data-testid="proposal-brief-textarea"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>

            {savedProposal?._id && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Draft Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-violet-400 focus:outline-none"
                >
                  {PROPOSAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              data-testid="generate-proposal-btn"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? 'Generating Proposal…' : 'Generate Proposal with AI'}
            </button>
          </form>
        </section>

        {/* Step 2: Editable Proposal Workspace OR Print View */}
        {(isGenerating || workspaceUnlocked) && (
          <section className="xl:col-span-8 space-y-5">
            {isGenerating ? (
              <AiGenerationSkeleton />
            ) : viewMode === 'preview' ? (
              <div className="proposal-sheet-stage overflow-auto rounded-2xl border border-slate-200 p-4 sm:p-6">
                <ProposalPrintDocument
                  proposal={{
                    ...form,
                    proposalNumber: savedProposal?.proposalNumber || 'DRAFT',
                    createdAt: savedProposal?.createdAt,
                  }}
                  businessProfile={businessProfile}
                />
              </div>
            ) : (
              <div className="no-print space-y-4" data-testid="proposal-editable-workspace">
                {/* Executive Summary */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-violet-700">
                    Executive Summary
                  </label>
                  <textarea
                    rows={3}
                    value={form.sections.executiveSummary}
                    onChange={(e) =>
                      updateSectionField('executiveSummary', e.target.value)
                    }
                    data-testid="section-executive-summary"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-400 focus:outline-none"
                  />
                </div>

                {/* Problem Statement & Proposed Solution */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-violet-700">
                      Problem Statement
                    </label>
                    <textarea
                      rows={4}
                      value={form.sections.problemStatement}
                      onChange={(e) =>
                        updateSectionField('problemStatement', e.target.value)
                      }
                      data-testid="section-problem-statement"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-violet-700">
                      Proposed Solution
                    </label>
                    <textarea
                      rows={4}
                      value={form.sections.proposedSolution}
                      onChange={(e) =>
                        updateSectionField('proposedSolution', e.target.value)
                      }
                      data-testid="section-proposed-solution"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Deliverables List Editor */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
                      Deliverables
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSectionField('deliverables', [
                          ...form.sections.deliverables,
                          '',
                        ])
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Deliverable
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {form.sections.deliverables.map((deliv, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />
                        <input
                          type="text"
                          value={deliv}
                          onChange={(e) => {
                            const next = [...form.sections.deliverables];
                            next[idx] = e.target.value;
                            updateSectionField('deliverables', next);
                          }}
                          placeholder={`Deliverable #${idx + 1}`}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none"
                        />
                        {form.sections.deliverables.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSectionField(
                                'deliverables',
                                form.sections.deliverables.filter((_, i) => i !== idx)
                              )
                            }
                            aria-label="Remove deliverable"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline & Milestones Table Editor */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
                      Timeline &amp; Milestones
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSectionField('timeline', [
                          ...form.sections.timeline,
                          { phase: '', duration: '', summary: '' },
                        ])
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Phase
                    </button>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {form.sections.timeline.map((row, idx) => (
                      <div
                        key={idx}
                        className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 sm:grid-cols-12"
                      >
                        <input
                          type="text"
                          value={row.phase}
                          onChange={(e) => {
                            const next = [...form.sections.timeline];
                            next[idx] = { ...next[idx], phase: e.target.value };
                            updateSectionField('timeline', next);
                          }}
                          placeholder="Phase name"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 sm:col-span-3"
                        />
                        <input
                          type="text"
                          value={row.duration}
                          onChange={(e) => {
                            const next = [...form.sections.timeline];
                            next[idx] = { ...next[idx], duration: e.target.value };
                            updateSectionField('timeline', next);
                          }}
                          placeholder="Duration"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 sm:col-span-2"
                        />
                        <input
                          type="text"
                          value={row.summary}
                          onChange={(e) => {
                            const next = [...form.sections.timeline];
                            next[idx] = { ...next[idx], summary: e.target.value };
                            updateSectionField('timeline', next);
                          }}
                          placeholder="Key milestone outcomes"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 sm:col-span-6"
                        />
                        <div className="flex items-center justify-end sm:col-span-1">
                          {form.sections.timeline.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSectionField(
                                  'timeline',
                                  form.sections.timeline.filter((_, i) => i !== idx)
                                )
                              }
                              aria-label="Remove phase"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested Pricing Breakdown */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
                        Suggested Pricing Breakdown
                      </span>
                      <p className="text-xs text-slate-500">
                        Transfers directly as line items when handed off to Quotation Generator.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          suggestedLineItems: [
                            ...prev.suggestedLineItems,
                            { description: '', quantity: 1, unitPrice: 0 },
                          ],
                        }))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Line Item
                    </button>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left text-xs">
                      <thead className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2 pr-2">Description</th>
                          <th className="w-24 py-2 px-2 text-right">Qty</th>
                          <th className="w-36 py-2 px-2 text-right">
                            Unit Price ({form.currency})
                          </th>
                          <th className="w-32 py-2 px-2 text-right">Total</th>
                          <th className="w-10 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {form.suggestedLineItems.map((item, idx) => {
                          const lineTotal =
                            (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                          return (
                            <tr key={idx}>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => {
                                    const next = [...form.suggestedLineItems];
                                    next[idx] = {
                                      ...next[idx],
                                      description: e.target.value,
                                    };
                                    setForm((prev) => ({
                                      ...prev,
                                      suggestedLineItems: next,
                                    }));
                                  }}
                                  placeholder="Deliverable or service item"
                                  data-testid={`line-item-desc-${idx}`}
                                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-violet-400 focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const next = [...form.suggestedLineItems];
                                    next[idx] = {
                                      ...next[idx],
                                      quantity: e.target.value,
                                    };
                                    setForm((prev) => ({
                                      ...prev,
                                      suggestedLineItems: next,
                                    }));
                                  }}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right text-xs text-slate-900"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const next = [...form.suggestedLineItems];
                                    next[idx] = {
                                      ...next[idx],
                                      unitPrice: e.target.value,
                                    };
                                    setForm((prev) => ({
                                      ...prev,
                                      suggestedLineItems: next,
                                    }));
                                  }}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right text-xs text-slate-900"
                                />
                              </td>
                              <td className="py-2 px-2 text-right font-bold tabular-nums text-slate-800">
                                {form.currency}{' '}
                                {lineTotal.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-2 text-right">
                                {form.suggestedLineItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setForm((prev) => ({
                                        ...prev,
                                        suggestedLineItems:
                                          prev.suggestedLineItems.filter(
                                            (_, i) => i !== idx
                                          ),
                                      }))
                                    }
                                    aria-label="Remove pricing row"
                                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-500">
                        Estimated Total:{' '}
                      </span>
                      <span
                        className="text-base font-extrabold text-violet-700"
                        data-testid="proposal-estimated-total"
                      >
                        {form.currency}{' '}
                        {estimatedTotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terms & Next Steps */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-violet-700">
                    Terms &amp; Next Steps
                  </label>
                  <textarea
                    rows={3}
                    value={form.sections.termsAndNextSteps}
                    onChange={(e) =>
                      updateSectionField('termsAndNextSteps', e.target.value)
                    }
                    data-testid="section-terms-next-steps"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-400 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Saved Proposals Drawer */}
      <SavedProposalsDrawer
        isOpen={drawerOpen}
        proposals={savedList}
        loading={loadingSavedList}
        activeProposalId={savedProposal?._id || null}
        onClose={() => setDrawerOpen(false)}
        onLoadProposal={handleLoadProposal}
        onDeleteProposal={handleDeleteProposal}
      />
    </div>
  );
}

export default AiProposalWriterPage;
