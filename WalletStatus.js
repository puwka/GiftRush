import { useTonConnectUI } from '@tonconnect/ui-react';

export function WalletStatus() {
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    if (tonConnectUI.connected) {
      console.log('Wallet address:', tonConnectUI.account?.address);
    }
  }, [tonConnectUI.connected]);

  return null;
}