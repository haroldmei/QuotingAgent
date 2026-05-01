import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

/**
 * Seed script for QuotingAgent
 *
 * Creates 3 demo crews (roofer, painter, plumber) in Western Sydney with:
 * - 1 owner user per crew
 * - 5 demo leads per crew (mix of DA and manual, various statuses)
 * - 1 fully-priced draft quote per crew
 * - Bunnings/Reece reference rate-card items (50-100 SKUs)
 *
 * Stack contract: postgres 16, pgvector, prisma 5
 * Design: docs/03-system-design.md §3
 */

// Demo crew data (Western Sydney postcodes: 2750 Penrith, 2760 Blacktown, 2171 Parramatta)
const DEMO_CREWS = [
  {
    id: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    businessName: 'Sydney Roofing Co',
    tradeType: 'roofer' as const,
    nswLicenceNumber: 'L001234567',
    defaultLabourRateAud: 85,
    abn: '12345678901',
  },
  {
    id: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    businessName: 'Penrith Painters Pty Ltd',
    tradeType: 'painter' as const,
    nswLicenceNumber: 'L002345678',
    defaultLabourRateAud: 65,
    abn: '23456789012',
  },
  {
    id: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    businessName: 'Blacktown Plumbing Services',
    tradeType: 'plumber' as const,
    nswLicenceNumber: 'L003456789',
    defaultLabourRateAud: 95,
    abn: '34567890123',
  },
]

const DEMO_USERS = [
  {
    id: '108018c7-e3c0-509c-a45d-7fb9f43716ea',
    crewId: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    phone: '+61412345678',
    role: 'owner' as const,
  },
  {
    id: '57b90b55-b918-502f-9045-6e14d5706886',
    crewId: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    phone: '+61423456789',
    role: 'owner' as const,
  },
  {
    id: '44c498ad-b439-514e-a546-404098b8b6ea',
    crewId: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    phone: '+61434567890',
    role: 'owner' as const,
  },
]

const DEMO_LEADS = [
  // Crew 001 (Roofer) leads
  {
    id: 'd4400ef5-8369-50e3-9bad-4a9c95560e6b',
    crewId: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    source: 'da' as const,
    daReference: 'DA-2026-00123',
    customerName: 'John Smith',
    customerMobile: '+61412223344',
    customerEmail: 'john.smith@example.com',
    address: '42 Gum Street, Penrith NSW 2750',
    description: 're-roof, colorbond, 180m2, pitched, single storey',
    status: 'won' as const,
  },
  {
    id: '652ca69b-496b-5b27-b36b-93ea0cccf0bd',
    crewId: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    source: 'da' as const,
    daReference: 'DA-2026-00124',
    customerName: 'Sarah Johnson',
    customerMobile: '+61412334455',
    customerEmail: 'sarah@example.com',
    address: '123 Oak Avenue, Penrith NSW 2750',
    description: 'guttering replacement + repairs',
    status: 'sent' as const,
  },
  {
    id: 'b0ce8128-b40d-54b4-bcd3-fe1e03db52a9',
    crewId: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    source: 'manual' as const,
    daReference: null,
    customerName: 'Michael Brown',
    customerMobile: '+61412445566',
    customerEmail: 'michael.b@example.com',
    address: '789 Maple Road, Blacktown NSW 2148',
    description: 'roof inspection and leak repair',
    status: 'draft_ready' as const,
  },
  {
    id: '08c1505e-db9a-5958-92a6-008c086eb952',
    crewId: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    source: 'da' as const,
    daReference: 'DA-2026-00125',
    customerName: 'Emma Wilson',
    customerMobile: '+61412556677',
    customerEmail: 'emma.w@example.com',
    address: '456 Elm Street, Penrith NSW 2750',
    description: 'full roof replacement with insulation',
    status: 'generating' as const,
  },
  {
    id: '75b1f3cf-5b1e-56fc-a6b7-724e760dcc6e',
    crewId: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    source: 'manual' as const,
    daReference: null,
    customerName: 'David Lee',
    customerMobile: '+61412667788',
    customerEmail: 'david.lee@example.com',
    address: '321 Pine Lane, Parramatta NSW 2150',
    description: 'roof repairs and minor gutter work',
    status: 'new' as const,
  },

  // Crew 002 (Painter) leads
  {
    id: 'afc1d35e-7420-5aaf-bc2d-582d0d365241',
    crewId: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    source: 'da' as const,
    daReference: 'DA-2026-00200',
    customerName: 'Rachel Green',
    customerMobile: '+61423334455',
    customerEmail: 'rachel@example.com',
    address: '555 Cedar Drive, Penrith NSW 2750',
    description: 'interior house painting, 3 bedrooms',
    status: 'won' as const,
  },
  {
    id: 'ee8f5bf7-105e-5bc8-a279-3285db79e826',
    crewId: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    source: 'manual' as const,
    daReference: null,
    customerName: 'Lisa Anderson',
    customerMobile: '+61423445566',
    customerEmail: 'lisa.a@example.com',
    address: '999 Willow Court, Blacktown NSW 2148',
    description: 'exterior house painting + weatherboard repair',
    status: 'sent' as const,
  },
  {
    id: 'afceac10-5200-5d96-9cc6-62be746e580a',
    crewId: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    source: 'da' as const,
    daReference: 'DA-2026-00201',
    customerName: 'Chris Martinez',
    customerMobile: '+61423556677',
    customerEmail: 'chris.m@example.com',
    address: '111 Birch Road, Parramatta NSW 2150',
    description: 'fence painting and stain',
    status: 'draft_ready' as const,
  },
  {
    id: 'fc1564e0-9c44-5fda-8936-37a25c9f3cbd',
    crewId: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    source: 'manual' as const,
    daReference: null,
    customerName: 'Karen White',
    customerMobile: '+61423667788',
    customerEmail: 'karen.white@example.com',
    address: '222 Spruce Lane, Penrith NSW 2750',
    description: 'apartment interior refresh, 2 rooms',
    status: 'new' as const,
  },
  {
    id: '3fdbd1b9-485d-519f-be64-2f1e0ca323ff',
    crewId: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    source: 'da' as const,
    daReference: 'DA-2026-00202',
    customerName: 'Tom Harris',
    customerMobile: '+61423778899',
    customerEmail: 'tom.h@example.com',
    address: '333 Acacia Street, Blacktown NSW 2148',
    description: 'commercial unit painting',
    status: 'generating' as const,
  },

  // Crew 003 (Plumber) leads
  {
    id: '63e8ede8-115f-5489-84f5-2837978a2878',
    crewId: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    source: 'da' as const,
    daReference: 'DA-2026-00300',
    customerName: 'Angela Clark',
    customerMobile: '+61434445566',
    customerEmail: 'angela.c@example.com',
    address: '888 Juniper Way, Parramatta NSW 2150',
    description: 'bathroom renovation, new shower, toilet, vanity',
    status: 'won' as const,
  },
  {
    id: 'dce20d9c-3502-59b0-9fb9-9d6f816223a0',
    crewId: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    source: 'manual' as const,
    daReference: null,
    customerName: 'Mark Taylor',
    customerMobile: '+61434556677',
    customerEmail: 'mark.t@example.com',
    address: '777 Ash Avenue, Penrith NSW 2750',
    description: 'hot water system replacement',
    status: 'sent' as const,
  },
  {
    id: '0c0b4021-02a3-57af-9139-9bb9d65a30d2',
    crewId: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    source: 'da' as const,
    daReference: 'DA-2026-00301',
    customerName: 'Sophia Taylor',
    customerMobile: '+61434667788',
    customerEmail: 'sophia.t@example.com',
    address: '666 Hazel Road, Blacktown NSW 2148',
    description: 'kitchen renovation plumbing, new sink, dishwasher',
    status: 'draft_ready' as const,
  },
  {
    id: 'bebd1578-75f3-59b0-b8d2-17ebbd4a5c00',
    crewId: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    source: 'manual' as const,
    daReference: null,
    customerName: 'James Patterson',
    customerMobile: '+61434778899',
    customerEmail: 'james.p@example.com',
    address: '444 Laurel Drive, Parramatta NSW 2150',
    description: 'drains cleaning + inspection',
    status: 'new' as const,
  },
  {
    id: 'b6109981-7419-54d6-8b89-d22d650d3cf5',
    crewId: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    source: 'da' as const,
    daReference: 'DA-2026-00302',
    customerName: 'Nina Sharma',
    customerMobile: '+61434889900',
    customerEmail: 'nina.s@example.com',
    address: '555 Oak Crescent, Blacktown NSW 2148',
    description: 'water filter system installation',
    status: 'generating' as const,
  },
]

// Demo quotes (1 per crew, all in draft/approved for dogfood visibility)
const DEMO_QUOTES = [
  {
    id: '8457516b-705f-56e4-9602-a616e9feaed9',
    leadId: 'd4400ef5-8369-50e3-9bad-4a9c95560e6b',
    crewId: 'fa36070e-edef-5df8-920a-e8a0437a7d51',
    status: 'approved' as const,
    subtotalAud: 4200,
    gstAud: 420,
    totalAud: 4620,
    licenceNumberSnapshot: 'L001234567',
    licenceVerifiedSnapshot: true,
    statutoryWarrantyText:
      'This work is subject to the Home Building Act 1989 and carries a statutory warranty of 6.5 years for major defects and 2 years for non-major defects.',
    rateCardSource: 'live' as const,
  },
  {
    id: '272b0d9f-f6c8-50f5-a2e3-683daf777e7a',
    leadId: 'afc1d35e-7420-5aaf-bc2d-582d0d365241',
    crewId: 'e176712c-e8fa-5bac-af9d-1763db75e8e3',
    status: 'approved' as const,
    subtotalAud: 1800,
    gstAud: 180,
    totalAud: 1980,
    licenceNumberSnapshot: 'L002345678',
    licenceVerifiedSnapshot: true,
    statutoryWarrantyText:
      'This work is subject to the Home Building Act 1989 and carries a statutory warranty of 6.5 years for major defects and 2 years for non-major defects.',
    rateCardSource: 'live' as const,
  },
  {
    id: 'f84c7b47-8eaf-5873-a666-483ac36c0c74',
    leadId: '63e8ede8-115f-5489-84f5-2837978a2878',
    crewId: 'b013d74c-b8ba-5099-a5f6-3fc7f5b8718e',
    status: 'approved' as const,
    subtotalAud: 3500,
    gstAud: 350,
    totalAud: 3850,
    licenceNumberSnapshot: 'L003456789',
    licenceVerifiedSnapshot: true,
    statutoryWarrantyText:
      'This work is subject to the Home Building Act 1989 and carries a statutory warranty of 6.5 years for major defects and 2 years for non-major defects.',
    rateCardSource: 'live' as const,
  },
]

// Demo quote line items (5-10 per quote)
const DEMO_LINE_ITEMS = [
  // Quote 001 (Roofing)
  {
    id: '4bfa0c89-df2e-5239-8a99-d7603b1dcd24',
    quoteId: '8457516b-705f-56e4-9602-a616e9feaed9',
    description: 'Colorbond roof sheets - Monument',
    qty: 180,
    unit: 'm2',
    unitPriceAud: 18.5,
    confidenceScore: 92,
    kind: 'material' as const,
    sortOrder: 1,
  },
  {
    id: '7e1e1d80-176e-5be7-8a58-1b071214965a',
    quoteId: '8457516b-705f-56e4-9602-a616e9feaed9',
    description: 'Roof installation labour',
    qty: 45,
    unit: 'hr',
    unitPriceAud: 85,
    confidenceScore: 88,
    kind: 'labour' as const,
    sortOrder: 2,
  },
  {
    id: 'a08ea154-3a80-5db2-9567-92c66f98ef74',
    quoteId: '8457516b-705f-56e4-9602-a616e9feaed9',
    description: 'Flashing and ridge capping',
    qty: 150,
    unit: 'm',
    unitPriceAud: 12,
    confidenceScore: 85,
    kind: 'material' as const,
    sortOrder: 3,
  },
  {
    id: '8426c119-bc08-516a-a4b3-2907791fb9b5',
    quoteId: '8457516b-705f-56e4-9602-a616e9feaed9',
    description: 'Old roof removal and disposal',
    qty: 180,
    unit: 'm2',
    unitPriceAud: 8,
    confidenceScore: 78,
    kind: 'labour' as const,
    sortOrder: 4,
  },
  {
    id: 'acc7e281-930a-59a9-8a65-3826bbc4a050',
    quoteId: '8457516b-705f-56e4-9602-a616e9feaed9',
    description: 'Roof gutters and downpipes',
    qty: 60,
    unit: 'm',
    unitPriceAud: 15,
    confidenceScore: 82,
    kind: 'material' as const,
    sortOrder: 5,
  },

  // Quote 002 (Painting)
  {
    id: 'd0cfd790-4899-5905-8466-827eb00f86ee',
    quoteId: '272b0d9f-f6c8-50f5-a2e3-683daf777e7a',
    description: 'Dulux Acrylic paint - White',
    qty: 20,
    unit: 'L',
    unitPriceAud: 28.5,
    confidenceScore: 90,
    kind: 'material' as const,
    sortOrder: 1,
  },
  {
    id: '057196b5-70ea-5ee1-be1f-be645fd217fb',
    quoteId: '272b0d9f-f6c8-50f5-a2e3-683daf777e7a',
    description: 'Interior painting labour',
    qty: 20,
    unit: 'hr',
    unitPriceAud: 65,
    confidenceScore: 89,
    kind: 'labour' as const,
    sortOrder: 2,
  },
  {
    id: 'ed84316e-ae86-588c-8fad-f1c5f2c6ce6f',
    quoteId: '272b0d9f-f6c8-50f5-a2e3-683daf777e7a',
    description: 'Surface preparation (sanding, patching)',
    qty: 8,
    unit: 'hr',
    unitPriceAud: 65,
    confidenceScore: 84,
    kind: 'labour' as const,
    sortOrder: 3,
  },

  // Quote 003 (Plumbing)
  {
    id: 'bd9da1dd-a047-5008-8425-18019c0f822f',
    quoteId: 'f84c7b47-8eaf-5873-a666-483ac36c0c74',
    description: 'Bathroom suite (WC, basin, bath)',
    qty: 1,
    unit: 'set',
    unitPriceAud: 1200,
    confidenceScore: 86,
    kind: 'material' as const,
    sortOrder: 1,
  },
  {
    id: '0bcbf0ca-8775-5f67-88a9-634dbbc8a1c1',
    quoteId: 'f84c7b47-8eaf-5873-a666-483ac36c0c74',
    description: 'Shower screen (frameless, 1200mm)',
    qty: 1,
    unit: 'ea',
    unitPriceAud: 650,
    confidenceScore: 88,
    kind: 'material' as const,
    sortOrder: 2,
  },
  {
    id: 'b96cf5c1-86d6-530e-a6c7-700fce9e5cd1',
    quoteId: 'f84c7b47-8eaf-5873-a666-483ac36c0c74',
    description: 'Bathroom renovation labour',
    qty: 35,
    unit: 'hr',
    unitPriceAud: 95,
    confidenceScore: 87,
    kind: 'labour' as const,
    sortOrder: 3,
  },
  {
    id: 'a2ab8a6e-397e-5247-9cb3-9f4be56a1f15',
    quoteId: 'f84c7b47-8eaf-5873-a666-483ac36c0c74',
    description: 'Waterproofing and tiling labour',
    qty: 10,
    unit: 'hr',
    unitPriceAud: 95,
    confidenceScore: 80,
    kind: 'labour' as const,
    sortOrder: 4,
  },
]

// Bunnings/Reece rate-card items (50-100 SKUs for realistic demo)
const DEMO_RATE_CARD_ITEMS = [
  // Roofing materials
  { supplier: 'Bunnings', sku: 'CCOLOR-MON-18', description: 'Colorbond roof sheets - Monument 0.42mm', priceAud: 18.5 },
  { supplier: 'Bunnings', sku: 'CCOLOR-SURF-18', description: 'Colorbond roof sheets - Surfmist 0.42mm', priceAud: 18.5 },
  { supplier: 'Bunnings', sku: 'CFLASH-001', description: 'Roof flashing kit (10m)', priceAud: 95 },
  { supplier: 'Bunnings', sku: 'CRIDGE-CAP', description: 'Ridge capping (per metre)', priceAud: 12 },
  { supplier: 'Bunnings', sku: 'CGUTTER-ALUM', description: 'Aluminium guttering (per metre)', priceAud: 15 },
  { supplier: 'Bunnings', sku: 'CDOWNPIPE-75', description: '75mm downpipe (per metre)', priceAud: 8.5 },

  // Plumbing materials
  { supplier: 'Reece', sku: 'BATHROOM-SUITE-ECO', description: 'Bathroom suite - ECO range', priceAud: 1200 },
  { supplier: 'Reece', sku: 'SHOWERSCREEN-1200', description: 'Frameless shower screen 1200mm', priceAud: 650 },
  { supplier: 'Reece', sku: 'TAP-MONOBLOC', description: 'Monobloc kitchen/bathroom tap', priceAud: 180 },
  { supplier: 'Reece', sku: 'WASTE-KIT-SET', description: 'Sink waste kit with P-trap', priceAud: 65 },
  { supplier: 'Reece', sku: 'PIPE-PVC-20MM', description: 'PVC water pipe 20mm (per metre)', priceAud: 3.2 },
  { supplier: 'Reece', sku: 'TILES-CERAMIC-400', description: 'Ceramic tiles 400x400mm (per m2)', priceAud: 45 },

  // Painting materials
  { supplier: 'Bunnings', sku: 'DULUX-ACRYLIC-WHITE', description: 'Dulux Acrylic paint - White 10L', priceAud: 285 },
  { supplier: 'Bunnings', sku: 'DULUX-ACRYLIC-CREAM', description: 'Dulux Acrylic paint - Cream 10L', priceAud: 285 },
  { supplier: 'Bunnings', sku: 'DULUX-ACRYLIC-GREY', description: 'Dulux Acrylic paint - Light Grey 10L', priceAud: 285 },
  { supplier: 'Bunnings', sku: 'PAINT-BRUSH-SET', description: 'Paint brush set (5 piece)', priceAud: 24.5 },
  { supplier: 'Bunnings', sku: 'PAINT-ROLLER-9MM', description: '9mm paint roller (2 pack)', priceAud: 12 },
  { supplier: 'Bunnings', sku: 'SANDPAPER-ASSORT', description: 'Sandpaper assortment pack', priceAud: 16.5 },

  // General materials (cross-trade)
  { supplier: 'Bunnings', sku: 'TIMBER-PINE-2x4', description: 'Pine timber 2x4" (per metre)', priceAud: 8.5 },
  { supplier: 'Bunnings', sku: 'NAILS-COIL-100MM', description: '100mm coil nails 2.5kg', priceAud: 18.5 },
  { supplier: 'Bunnings', sku: 'SCREWS-DECK-4.8', description: '4.8x75mm deck screws 1kg', priceAud: 22 },
  { supplier: 'Bunnings', sku: 'SEALANT-ACRYLIC-350', description: 'Acrylic sealant 350ml cartridge', priceAud: 6.5 },
  { supplier: 'Bunnings', sku: 'SILICONE-CLEAR-350', description: 'Silicone sealant (clear) 350ml', priceAud: 8.5 },
  { supplier: 'Bunnings', sku: 'CEMENT-20KG', description: 'Portland cement 20kg bag', priceAud: 12.5 },

  // Electrical (for plumber reference)
  { supplier: 'Bunnings', sku: 'CABLE-2.5MM-100', description: '2.5mm electrical cable (100m reel)', priceAud: 85 },
  { supplier: 'Bunnings', sku: 'SWITCH-SINGLE-PLATE', description: 'Single light switch with plate', priceAud: 8.5 },
  { supplier: 'Bunnings', sku: 'POWERPOINT-SINGLE', description: 'Single power point with plate', priceAud: 9.5 },

  // Fasteners & fixings
  { supplier: 'Bunnings', sku: 'BOLTS-M10-100', description: 'M10 bolts with nuts (50 pack)', priceAud: 32 },
  { supplier: 'Bunnings', sku: 'BRACKETS-ANGLE-50', description: '50x50mm angle brackets (10 pack)', priceAud: 18 },
  { supplier: 'Bunnings', sku: 'HINGES-STAINLESS-3', description: 'Stainless hinges 75mm (3 pack)', priceAud: 24 },

  // Safety & PPE
  { supplier: 'Bunnings', sku: 'GLOVES-WORK-LEATHER', description: 'Work gloves leather (pair)', priceAud: 12.5 },
  { supplier: 'Bunnings', sku: 'SAFETY-GLASSES', description: 'Safety glasses UV protection', priceAud: 8.5 },
  { supplier: 'Bunnings', sku: 'MASK-N95-50PACK', description: 'N95 face masks (50 pack)', priceAud: 22 },

  // Finishing materials
  { supplier: 'Bunnings', sku: 'STAIN-TIMBER-CEDAR', description: 'Timber stain - Cedar 1L', priceAud: 18.5 },
  { supplier: 'Bunnings', sku: 'VARNISH-GLOSS-1L', description: 'Polyurethane varnish gloss 1L', priceAud: 22 },
  { supplier: 'Bunnings', sku: 'CAULK-ACRYLIC-PAINT', description: 'Paintable caulk 320ml cartridge', priceAud: 9 },

  // Tools (material reference for quotes)
  { supplier: 'Bunnings', sku: 'LEVEL-1200MM', description: 'Spirit level 1200mm', priceAud: 35 },
  { supplier: 'Bunnings', sku: 'TAPE-MEASURE-8M', description: 'Tape measure 8m', priceAud: 12 },
  { supplier: 'Bunnings', sku: 'DRILL-IMPACT-20V', description: '20V impact drill (bare tool)', priceAud: 98 },
]

async function main() {
  console.log('🌱 Starting seed...')

  try {
    // 1. Seed crews
    console.log('📋 Seeding crews...')
    for (const crew of DEMO_CREWS) {
      await prisma.crew.upsert({
        where: { id: crew.id },
        update: {},
        create: {
          id: crew.id,
          businessName: crew.businessName,
          tradeType: crew.tradeType,
          nswLicenceNumber: crew.nswLicenceNumber,
          licenceVerified: true,
          licenceVerifiedAt: new Date(),
          defaultLabourRateAud: crew.defaultLabourRateAud,
          abn: crew.abn,
        },
      })
    }
    console.log(`✅ ${DEMO_CREWS.length} crews seeded`)

    // 2. Seed users
    console.log('👤 Seeding users...')
    for (const user of DEMO_USERS) {
      // Note: In real prod, user.id would be a Supabase Auth UUID
      // For seed purposes, we create the user record directly with the demo UUID
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          crewId: user.crewId,
          phone: user.phone,
          role: user.role,
        },
      })
    }
    console.log(`✅ ${DEMO_USERS.length} users seeded`)

    // 3. Seed leads
    console.log('🎯 Seeding leads...')
    for (const lead of DEMO_LEADS) {
      await prisma.lead.upsert({
        where: { id: lead.id },
        update: {},
        create: {
          id: lead.id,
          crewId: lead.crewId,
          source: lead.source,
          daReference: lead.daReference,
          customerName: lead.customerName,
          customerMobile: lead.customerMobile,
          customerEmail: lead.customerEmail,
          address: lead.address,
          description: lead.description,
          status: lead.status,
        },
      })
    }
    console.log(`✅ ${DEMO_LEADS.length} leads seeded`)

    // 4. Seed quotes
    console.log('📄 Seeding quotes...')
    for (const quote of DEMO_QUOTES) {
      await prisma.quote.upsert({
        where: { id: quote.id },
        update: {},
        create: {
          id: quote.id,
          leadId: quote.leadId,
          crewId: quote.crewId,
          status: quote.status,
          subtotalAud: quote.subtotalAud,
          gstAud: quote.gstAud,
          totalAud: quote.totalAud,
          licenceNumberSnapshot: quote.licenceNumberSnapshot,
          licenceVerifiedSnapshot: quote.licenceVerifiedSnapshot,
          statutoryWarrantyText: quote.statutoryWarrantyText,
          rateCardSource: quote.rateCardSource,
        },
      })
    }
    console.log(`✅ ${DEMO_QUOTES.length} quotes seeded`)

    // 5. Seed quote line items
    console.log('📝 Seeding quote line items...')
    for (const item of DEMO_LINE_ITEMS) {
      await prisma.quoteLineItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          quoteId: item.quoteId,
          description: item.description,
          qty: item.qty,
          unit: item.unit,
          unitPriceAud: item.unitPriceAud,
          confidenceScore: item.confidenceScore,
          kind: item.kind,
          sortOrder: item.sortOrder,
        },
      })
    }
    console.log(`✅ ${DEMO_LINE_ITEMS.length} quote line items seeded`)

    // 6. Seed rate-card items (Bunnings/Reece reference pricing)
    console.log('💰 Seeding rate-card items...')
    for (const item of DEMO_RATE_CARD_ITEMS) {
      await prisma.rateCardItem.upsert({
        where: {
          supplier_sku: {
            supplier: item.supplier,
            sku: item.sku,
          },
        },
        update: {
          priceAud: item.priceAud,
          fetchedAt: new Date(),
          stale: false,
        },
        create: {
          id: randomUUID(),
          supplier: item.supplier,
          sku: item.sku,
          description: item.description,
          priceAud: item.priceAud,
          fetchedAt: new Date(),
          stale: false,
        },
      })
    }
    console.log(`✅ ${DEMO_RATE_CARD_ITEMS.length} rate-card items seeded`)

    // Summary
    console.log('\n🎉 Seed complete!')
    const crewCount = await prisma.crew.count()
    const userCount = await prisma.user.count()
    const leadCount = await prisma.lead.count()
    const quoteCount = await prisma.quote.count()
    const lineItemCount = await prisma.quoteLineItem.count()
    const rateCardCount = await prisma.rateCardItem.count()

    console.log(`\nSeeded record counts:
  - crews: ${crewCount}
  - users: ${userCount}
  - leads: ${leadCount}
  - quotes: ${quoteCount}
  - quote_line_items: ${lineItemCount}
  - rate_card_items: ${rateCardCount}
`)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
