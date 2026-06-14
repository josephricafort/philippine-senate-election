import type { Metadata } from 'next';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  // TODO: read candidate_index.json and return slugs
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: slug,
    openGraph: { title: slug },
  };
}

export default async function SenatorPage({ params }: Props) {
  const { slug } = await params;
  // TODO: render senator story page
  return <main>{slug}</main>;
}
