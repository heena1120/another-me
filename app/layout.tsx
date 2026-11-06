import type { Metadata, Viewport } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import Nav from "@/components/Nav";
import AppHeader from "@/components/AppHeader";
import "./globals.css";
import "./hud.css";
import "./mobile.css";
import "./design.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: APP_TAGLINE,
};

// 모바일 화면 폭에 맞추고, 아이폰 노치·홈 인디케이터 영역까지 안전하게 씁니다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <AppHeader />
        {children}
        <Nav />
      </body>
    </html>
  );
}
