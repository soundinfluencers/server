// interface for account settings page
export interface ClientAccountDetails {
    firstName: string;
    companyName: string;
    email: string;
    phone: string;

    lastName?: string;
    profilePhotoUrl?: string;
    isProposal?: boolean;
}