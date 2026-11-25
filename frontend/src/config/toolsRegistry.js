export const TOOLS_REGISTRY = Object.freeze([
  {
    id: 'invoice-generator',
    name: 'Invoice Generator',
    shortName: 'Invoices',
    description:
      'Create tax-ready invoices in A4, A5, Letter, Legal, B5, or 80mm Thermal Receipt sizes with payment tracking.',
    route: '/tools/invoice-generator',
    badge: 'Tool 01',
    accent: 'indigo',
    guestReady: true,
    status: 'active',
  },
  {
    id: 'quotation-generator',
    name: 'Quotation Generator',
    shortName: 'Quotations',
    description:
      'Generate commercial quotes with validity presets, client acceptance blocks, and 1-click Invoice conversion.',
    route: '/tools/quotation-generator',
    badge: 'Tool 02',
    accent: 'emerald',
    guestReady: true,
    status: 'active',
  },
]);

export default TOOLS_REGISTRY;
