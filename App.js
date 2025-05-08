import { TonConnectUIProvider } from '@tonconnect/ui-react';

function App() {
  return (
    <TonConnectUIProvider
      manifestUrl="https://gift-rush.vercel.app/tonconnect-manifest.json"
      walletsListSource="https://raw.githubusercontent.com/ton-connect/wallets-list/main/wallets.json"
      network="testnet" // Добавьте эту строку для тестов
    >
      {/* Остальной код приложения */}
      <YourComponentWithWalletButton />
    </TonConnectUIProvider>
  );
}