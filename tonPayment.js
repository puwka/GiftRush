import { useTonConnectUI } from '@tonconnect/ui-react';

export async function sendTONPayment(amountTON, recipientAddress) {
  const [tonConnectUI] = useTonConnectUI();

  const transaction = {
    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 минут
    messages: [
      {
        address: recipientAddress, // Например: EQAB...3jk
        amount: (amountTON * 1000000000).toString(), // Конвертация в нанотоны
      }
    ]
  };

  try {
    const result = await tonConnectUI.sendTransaction(transaction);
    console.log('Payment successful:', result.boc);
    return true;
  } catch (error) {
    console.error('Payment failed:', error);
    return false;
  }
}