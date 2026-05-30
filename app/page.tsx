import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="bg-black text-white min-h-screen overflow-hidden">
      <Navbar />
      <Hero />
      <Features />
      <Footer />
    </main>
  );
}