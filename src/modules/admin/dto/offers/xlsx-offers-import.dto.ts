export interface XlsxOfferAccount {
  instagramUrl: string | null;
  pageName: string | null;
  followers: number;
}

export interface XlsxOfferBlock {
  sheetName: string;
  offerName: string;
  brand: string | null;
  storyAndPostDetails: string | null;
  price: number;
  totalFollowers: number;
  accounts: XlsxOfferAccount[];
  rowErrors: { rowNumber: number; message: string }[];
}

export interface XlsxOffersImportResult {
  offerBlocks: XlsxOfferBlock[];
  globalErrors: { sheetName: string; message: string }[];
}

export interface XlsxOffersImportSummary {
  createdOffers: number;
  skippedOffers: number;
  totalAccounts: number;
  matchedAccounts: number;
  unmatchedAccounts: { offerName: string; sheetName: string; username: string }[];
  errors: { sheetName: string; offerName?: string; rowNumber?: number; message: string }[];
}
