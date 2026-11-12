// Everything you might want to change without touching the code.
// Empty values switch that feature off (its section stays hidden).
export default {
  shopUrl: 'https://kgcpprintworks.etsy.com/',
  utmSource: 'kgcp_site', // shows up in Etsy stats / your trade journal as the traffic source

  // Short facts shown under the hero. Only list things that are true for every listing.
  promises: ['Secure checkout on Etsy', 'Free shipping in the contiguous US', 'Printed when you order'],

  instagram: 'kgcpprintworks', // handle without @, e.g. 'kgcpprintworks'

  // Shown when someone wins the matching game. Create the code in Etsy first
  // (Shop Manager > Marketing > Sales and discounts), then paste it here.
  promo: { code: '', text: '' }, // e.g. { code: 'MATCH10', text: '10% off your order' }

  // Poll votes go to a Google Form, so results land in a Google Sheet with no server.
  // formAction: the form's ".../formResponse" URL. entry: the question's "entry.123456" field name.
  poll: {
    question: 'What should we print next?',
    options: ['More gym gear', 'Funny stickers', 'Cozy hoodies', 'Something for pets'],
    formAction: '',
    entry: '',
  },

  // Read the note on ads in README.md before turning this on.
  ads: { adsenseClient: '', slot: '' }, // e.g. { adsenseClient: 'ca-pub-123', slot: '456' }
};
