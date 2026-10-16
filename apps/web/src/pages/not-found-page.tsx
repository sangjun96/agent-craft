import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/typography";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-12 sm:px-6">
      <Typography variant="h1">페이지를 찾을 수 없습니다</Typography>
      <Typography variant="muted">주소가 올바른지 확인해 주세요.</Typography>
      <Button render={<Link to="/" />} nativeButton={false}>
        홈으로
      </Button>
    </main>
  );
}
