import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  const isLoggedIn = !!session;

  return (
    <main className="bg-[#161412] text-white min-h-screen overflow-y-auto">
      <Navbar isLoggedIn={isLoggedIn} username={session?.username} />
      <Hero isLoggedIn={isLoggedIn} />
      <Features />
      <Footer />
    </main>
  );
}