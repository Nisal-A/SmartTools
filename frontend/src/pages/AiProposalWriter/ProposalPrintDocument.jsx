import React from 'react';
import './ProposalPrintStyles.css';

function formatMoney(amount, currency = 'LKR') {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  return `${String(currency || 'LKR').toUpperCase()} ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function computeProposalTotal(items = []) {
  return items.reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0;
    const price = Number(item?.unitPrice) || 0;
    return sum + Math.max(0, qty * price);
  }, 0);
}

export function ProposalPrintDocument({ proposal, businessProfile = null }) {
  const sections = proposal?.sections || {};
  const deliverables = Array.isArray(sections.deliverables) ? sections.deliverables : [];
  const timeline = Array.isArray(sections.timeline) ? sections.timeline : [];
  const lineItems = Array.isArray(proposal?.suggestedLineItems)
    ? proposal.suggestedLineItems
    : [];
  const estimatedTotal = computeProposalTotal(lineItems);

  const bizAddress =
    typeof businessProfile?.address === 'object'
      ? [
          businessProfile.address.street,
          businessProfile.address.city,
          businessProfile.address.state,
          businessProfile.address.postalCode,
          businessProfile.address.country,
        ]
          .filter(Boolean)
          .join(', ')
      : String(businessProfile?.address || '');

  const formattedDate = new Date(proposal?.createdAt || Date.now()).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' }
  );

  return (
    <div className="proposal-printable-root">
      <div className="proposal-sheet--a4 mx-auto space-y-6">
        {/* Document Header */}
        <header className="flex items-start justify-between border-b-2 border-violet-600 pb-5">
          <div>
            {businessProfile?.logoUrl && (
              <img
                src={businessProfile.logoUrl}
                alt={businessProfile.businessName || 'Business Logo'}
                className="mb-2 h-11 w-auto max-w-[160px] object-contain"
              />
            )}
            <p className="text-base font-extrabold text-slate-900">
              {businessProfile?.businessName || 'SmartTools Client Services'}
            </p>
            {(businessProfile?.email || businessProfile?.phone) && (
              <p className="text-xs text-slate-500">
                {[businessProfile.email, businessProfile.phone].filter(Boolean).join(' · ')}
              </p>
            )}
            {bizAddress && <p className="text-xs text-slate-500">{bizAddress}</p>}
          </div>

          <div className="text-right">
            <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-700">
              Project Proposal
            </span>
            <p className="mt-2 text-sm font-bold text-slate-900">
              {proposal?.proposalNumber || 'DRAFT PROPOSAL'}
            </p>
            <p className="text-xs text-slate-500">Prepared: {formattedDate}</p>
            <p className="text-xs text-slate-500">Tone: {proposal?.tone || 'Professional'}</p>
          </div>
        </header>

        {/* Client & Project Summary */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Prepared For
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {proposal?.clientName || 'Valued Client'}
              </p>
              {proposal?.clientCompany && (
                <p className="text-xs font-medium text-slate-600">{proposal.clientCompany}</p>
              )}
              {proposal?.clientEmail && (
                <p className="text-xs text-slate-500">{proposal.clientEmail}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Engagement Scope
              </p>
              <p className="mt-1 text-sm font-extrabold text-violet-800">
                {proposal?.projectTitle || 'Proposed Engagement'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Estimated Investment:{' '}
                <span className="font-bold text-slate-800">
                  {formatMoney(estimatedTotal, proposal?.currency)}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Narrative Sections */}
        {sections.executiveSummary && (
          <section className="proposal-keep-together">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
              1. Executive Summary
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
              {sections.executiveSummary}
            </p>
          </section>
        )}

        {sections.problemStatement && (
          <section className="proposal-keep-together">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
              2. Problem Statement &amp; Context
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
              {sections.problemStatement}
            </p>
          </section>
        )}

        {sections.proposedSolution && (
          <section className="proposal-keep-together">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
              3. Proposed Solution
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
              {sections.proposedSolution}
            </p>
          </section>
        )}

        {deliverables.length > 0 && (
          <section className="proposal-keep-together">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
              4. Key Deliverables
            </h2>
            <ul className="mt-2 space-y-1.5 pl-4 text-xs text-slate-700">
              {deliverables.map((item, idx) => (
                <li key={idx} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {timeline.length > 0 && (
          <section className="proposal-keep-together">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
              5. Project Timeline &amp; Milestones
            </h2>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2">Phase</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Milestone Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {timeline.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.phase}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.duration}</td>
                    <td className="px-3 py-2 text-slate-700">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {lineItems.length > 0 && (
          <section className="proposal-keep-together">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
              6. Estimated Investment Breakdown
            </h2>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2 text-left">Scope Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lineItems.map((item, idx) => {
                  const qty = Number(item.quantity) || 0;
                  const unitPrice = Number(item.unitPrice) || 0;
                  return (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium text-slate-800">{item.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {formatMoney(unitPrice, proposal?.currency)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatMoney(qty * unitPrice, proposal?.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-bold text-slate-700">
                    Total Estimated Investment
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-extrabold tabular-nums text-violet-700">
                    {formatMoney(estimatedTotal, proposal?.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {sections.termsAndNextSteps && (
          <section className="proposal-keep-together">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-700">
              7. Terms &amp; Next Steps
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
              {sections.termsAndNextSteps}
            </p>
          </section>
        )}

        {/* Acceptance Sign-off */}
        <footer className="proposal-keep-together grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 text-xs text-slate-600">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Prepared By
            </p>
            <div className="mt-8 border-t border-slate-300 pt-1.5 font-semibold text-slate-800">
              {businessProfile?.businessName || 'Authorized Representative'}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Client Acceptance
            </p>
            <div className="mt-8 border-t border-slate-300 pt-1.5 font-semibold text-slate-800">
              {proposal?.clientName || 'Client Signature'} &amp; Date
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default ProposalPrintDocument;
