import type { Viewport } from "next";
import MainScene from "./components/MainScene";

export const viewport: Viewport = {
  themeColor: "#050508",
  viewportFit: "cover",
};

export default function Home() {
  return (
    <main className="h-dvh w-full relative flex flex-col items-center justify-between overflow-hidden select-none">
      <MainScene />
    </main>
  );
}
