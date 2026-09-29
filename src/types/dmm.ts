export interface DmmItem {
  content_id: string;
  title: string;
  date: string;

  imageURL?: {
  large?: string;
  small?: string;
  list?: string;
};

sampleImageURL?: {
  sample_s?: {
    image: string[];
  };

  sample_l?: {
    image: string[];
  };
};
  URL?: string;           // FANZA作品URL
affiliateURL?: string;  // アフィリエイトURL

  prices: {
    price: string;
    list_price: string;
  };

  review?: {
    average: string;
    count: number;
  };

  iteminfo?: {
    actress?: { id?: number; name: string; ruby?: string }[];
    genre?: { name: string }[];
    maker?: { name: string }[];
    series?: { name: string }[];
  };

  rank?: number;
}

export interface DmmActressProfile {
  id?: number | string;
  actress_id?: number | string;
  name?: string;
  ruby?: string | null;
  bust?: number | string | null;
  cup?: string | null;
  waist?: number | string | null;
  hip?: number | string | null;
  height?: number | string | null;
  birthday?: string | null;
  blood_type?: string | null;
  hobby?: string | null;
  prefectures?: string | null;
  imageURL?: {
    small?: string | null;
    large?: string | null;
  };
  listURL?: {
    digital?: string | null;
    monthly?: string | null;
    mono?: string | null;
  };
}
