import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KnightX — Sign In',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f0e0c] flex items-center justify-center relative overflow-hidden">
      {/* Ambient background glows */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, #81b64c 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.05]"
        style={{
          background: 'radial-gradient(circle, #5c9e30 0%, transparent 70%)',
        }}
      />
      {/* Chess board pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            repeating-conic-gradient(
              #81b64c 0% 25%,
              transparent 0% 50%
            )`,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  );
}
