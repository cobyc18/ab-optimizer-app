// Shared A/B Test Ideas data
// Used in both the A/B flow conversion plays section and the dashboard test ideas carousel

export const abTestIdeas = [
  {
    id: 1,
    utility: 'How Many in Cart',
    rationale: 'Displaying an in-cart count highlights demand and motivates customers to act before the item sells out',
    style: ['Urgency', 'Social Proof'], // Array of tags
    preview: '👁️ 76 people viewing this page',
    blockId: 'simple-text-badge',
    appExtensionId: '5ff212573a3e19bae68ca45eae0a80c4',
    availableForGoals: ['Social Proof', 'Urgency'] // Goals this conversion play is available for
  },
  {
    id: 2,
    utility: 'Free Shipping Badge',
    rationale: 'Displaying a free-shipping badge helps build trust by showing customers there are no hidden costs',
    style: 'Increase Trust',
    preview: 'In-stock, ships in 1-2 business days | Free shipping & returns',
    blockId: 'simple-text-badge',
    appExtensionId: '5ff212573a3e19bae68ca45eae0a80c4'
  },
  {
    id: 3,
    utility: 'Returns Guarantee Badge',
    rationale: 'Displaying a refund guarantee builds trust by letting customers know they can shop without risk',
    style: 'Increase Trust',
    preview: 'Returns Guarantee Badge',
    blockId: 'simple-text-badge',
    appExtensionId: '5ff212573a3e19bae68ca45eae0a80c4'
  }
];
