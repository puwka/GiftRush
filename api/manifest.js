// api/manifest.js
export default function handler(request, response) {
    const manifest = {
      "url": "https://gift-rush.vercel.app",
      "name": "GiftRush",
      "iconUrl": "https://gift-rush.vercel.app/icon.png",
      "termsOfUseUrl": "https://gift-rush.vercel.app/terms",
      "privacyPolicyUrl": "https://gift-rush.vercel.app/privacy"
    };
  
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json(manifest);
  }