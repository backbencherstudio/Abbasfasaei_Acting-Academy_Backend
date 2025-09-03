export class CreatePostDto {
  authorId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'PHOTO' | 'VIDEO';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
}
