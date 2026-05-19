import { ReactNode } from "react";

/**
 * 페이지 상단 헤더 — main 스크롤 컨테이너 최상단(고정 Header 바로 아래)에 sticky로 고정.
 * 입력: 헤더 안에 그릴 내용(children)과 추가 클래스(className, 예: space-y-3)
 * 동작:
 *   - sticky top-0 z-30: 스크롤하면 main 스크롤 영역 최상단에 붙어 있도록
 *   - -mx-8 -mt-8 px-8 pt-8 pb-4: main의 p-8 패딩을 가로/세로로 침범해서 sticky 시 카드가 바 뒤로 깔끔하게 흘러가도록
 *   - 배경은 main과 동일한 bg-pearl-100 솔리드 → 추가 border/blur 없이 시각적 노이즈(흰 띠) 제거
 * 사용 규칙: 페이지 outer wrapper(보통 <div className="space-y-X">)의 첫 번째 자식으로 둘 것.
 * outer에 max-w가 걸려있으면 그 max-w를 본문 안쪽으로 옮긴 뒤 사용해야 바가 main 전체 폭을 덮음.
 */
export default function PageHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`sticky top-0 z-30 -mx-8 -mt-8 px-8 pt-8 pb-4 bg-pearl-100 ${className}`}
    >
      {children}
    </div>
  );
}
