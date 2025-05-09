module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      url: "https://gift-rush.vercel.app",
      name: "GiftRush",
      iconUrl: "https://gift-rush.vercel.app/icon.png",
      termsOfUseUrl: "https://gift-rush.vercel.app/terms",
      privacyPolicyUrl: "https://gift-rush.vercel.app/privacy"
    }));
  };