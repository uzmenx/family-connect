export interface User {
  id: string;
  email: string;
  full_name: string;
  username: string;
  bio: string;
  avatar_url: string;
  cover_url: string;
  instagram: string;
  telegram: string;
  followers_count: number;
  following_count: number;
  relatives_count: number;
  created_at: string;
}

export interface Relative {
  id: string;
  user_id: string;
  relative_name: string;
  relation_type: 'father' | 'mother' | 'sibling' | 'child' | 'spouse' | 'grandparent' | 'grandchild' | 'uncle' | 'aunt' | 'cousin';
  parent_relative_id: string | null;
  avatar_url: string;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string; // deprecated, use media_urls
  media_urls: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at?: string;
  author?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow' | 'relative_request';
  message: string;
  read: boolean;
  created_at: string;
}
