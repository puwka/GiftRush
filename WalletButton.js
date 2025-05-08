import { useTonConnectUI } from '@tonconnect/ui-react';

export function WalletButton() {
  const [tonConnectUI] = useTonConnectUI();

  const handleConnect = async () => {
    await tonConnectUI.connectWallet();
  };

  return (
    <button 
      onClick={handleConnect}
      className="ton-connect-button" // Стилизуйте кнопку в CSS
    >
      {tonConnectUI.connected ? 
        `Connected: ${tonConnectUI.account?.address.slice(0, 6)}...` : 
        'Connect TON Wallet'}
    </button>
  );
}