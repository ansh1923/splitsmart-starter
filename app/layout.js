import './globals.css';

export const metadata = {
  title: "Ansh TTMM SplitSmart",
  description: 'Ansh TTMM SplitSmart — Tu tera dekh, main mera dekhta hu.',
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
