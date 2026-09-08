import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'폐쇄런 | 멈추면 입원이다',description:'멘헤라짱의 심야 3D 도주 액션. 차를 피하고, 짭새와 구급차에게서 도망쳐라. 네 번 부딪히면 지금 바로 입원!'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>;}
