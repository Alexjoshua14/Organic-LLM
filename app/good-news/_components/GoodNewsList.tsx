import { GoodNewsCard } from "./GoodNewsCard";

import { GoodNewsItem } from "@/lib/schemas/good-news";

type Props = {
  items: GoodNewsItem[];
};

export function GoodNewsList({ items }: Props) {
  return (
    <ol className="flex list-none flex-col gap-4">
      {items.map((item) => (
        <li key={`${item.rank}-${item.headline}`}>
          <GoodNewsCard item={item} />
        </li>
      ))}
    </ol>
  );
}
