import './globals.css';

export const metadata = {
  title: "Ansh's Tu Tera Main Mera Expense Tracker",
  description: 'Tu tera dekh, main mera dekhta hu — Gen Z expense splitter.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
