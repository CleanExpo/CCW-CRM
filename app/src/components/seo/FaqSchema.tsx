import { JsonLd } from './JsonLd';

const FAQ_ITEMS = [
  {
    question: 'What is the best carpet cleaning machine for commercial use in Australia?',
    answer:
      'For commercial use in Australia, truck-mount systems offer the highest performance, delivering consistent hot water extraction with superior suction. For flexibility, portable extractors from brands like Prochem, Polivac, and Numatic are popular choices. CCW Online stocks a full range of commercial carpet cleaning machines with Australia-wide shipping and expert advice.',
  },
  {
    question: 'What chemicals does IICRC recommend for water damage restoration?',
    answer:
      'The IICRC recommends EPA-registered antimicrobials and biocides for Category 2 and 3 water damage restoration, including quaternary ammonium compounds and hydrogen peroxide-based products. For odour control, enzyme-based treatments and oxidising agents are standard. CCW Online supplies IICRC-compliant restoration chemicals and provides IICRC training courses to help technicians select the right products.',
  },
  {
    question: 'How much does professional carpet cleaning equipment cost in Australia?',
    answer:
      'Professional carpet cleaning equipment prices vary widely. Entry-level portable extractors start around $1,000-$3,000. Mid-range commercial units range from $3,000-$15,000. Truck-mount systems cost $20,000-$80,000+. CCW Online offers equipment financing and rent-to-buy options to help businesses get started with professional-grade machines.',
  },
  {
    question:
      'What is the difference between hot water extraction and dry cleaning methods for carpets?',
    answer:
      'Hot water extraction (steam cleaning) injects hot water and cleaning solution deep into carpet fibres, then extracts it along with dissolved dirt - ideal for deep cleaning and IICRC-recommended for most situations. Dry cleaning methods use minimal moisture with encapsulation or bonnet cleaning, allowing faster drying times. CCW Online supplies equipment and chemicals for both methods.',
  },
  {
    question: 'How do you maintain a truck-mount carpet cleaning system?',
    answer:
      'Regular truck-mount maintenance includes: daily flushing of solution and waste tanks, checking and changing vacuum filters, inspecting hoses for wear, lubricating pump seals, monitoring engine oil and coolant levels, and winterising in cold climates. CCW Online provides spare parts, service support, and technical advice for truck-mount systems across Australia.',
  },
  {
    question: 'What equipment is needed for Category 3 water damage restoration?',
    answer:
      'Category 3 (black water) restoration requires: high-capacity extraction equipment with containment, industrial air movers and dehumidifiers, HEPA air scrubbers, moisture metres and thermal imaging cameras, full PPE including respirators, goggles, and disposable suits, and EPA-registered disinfectants. CCW Online supplies complete Category 3 restoration equipment packages.',
  },
  {
    question: 'Can I buy commercial cleaning chemicals in bulk from CCW Online?',
    answer:
      'Yes, CCW Online offers bulk purchasing of professional cleaning chemicals including carpet pre-sprays, degreasers, antimicrobials, odour eliminators, and restoration chemicals. Bulk pricing is available for business customers, with Australia-wide delivery. Contact our sales team at sales@ccwonline.com.au for bulk pricing and volume discounts.',
  },
  {
    question: 'What PPE is required for mould remediation work in Australia?',
    answer:
      'For mould remediation in Australia, required PPE includes: P2 or P3 respirators (N95 minimum for larger jobs), disposable Tyvek suits, nitrile gloves, safety goggles or full face shields, and boot covers. Following AS/NZS 4418 guidelines and IICRC S520 standards is recommended. CCW Online supplies a full range of remediation PPE compliant with Australian standards.',
  },
  {
    question: 'What is the difference between hot water extraction and low moisture cleaning?',
    answer:
      'Hot water extraction uses high volumes of water injected at pressure and extracted immediately - best for deep cleaning and heavily soiled carpets. Low moisture cleaning (encapsulation or bonnet) uses minimal water for faster drying and maintenance cleaning. Hot water extraction is the gold standard recommended by IICRC and most carpet manufacturers for thorough cleaning.',
  },
  {
    question: 'Does CCW Online offer equipment financing or rent-to-buy options?',
    answer:
      'Yes, CCW Online offers flexible equipment financing and rent-to-buy options for professional carpet cleaning and restoration equipment. These programs allow businesses to access commercial-grade equipment with manageable payments rather than large upfront costs. Contact our team at 1300 229 273 or sales@ccwonline.com.au to discuss financing options.',
  },
];

export function FaqSchema() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return <JsonLd id="faq-schema" data={faqSchema} />;
}

export { FAQ_ITEMS };
