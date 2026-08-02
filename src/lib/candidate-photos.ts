import candidatePhotos from '../../public/data/candidate_photos.json';

export type CandidatePhoto = {
  path: string;
  position?: string;
  zoom?: number;
  offsetX?: string;
  offsetY?: string;
  rotate?: string;
  fit?: 'cover' | 'contain';
};

type CandidatePhotoEntry = string | CandidatePhoto;

const photosById = candidatePhotos as Record<string, CandidatePhotoEntry>;

export function getCandidatePhoto(senatorId: string): CandidatePhoto | null {
  const photo = photosById[senatorId];

  if (!photo) {
    return null;
  }

  return typeof photo === 'string' ? { path: photo } : photo;
}
