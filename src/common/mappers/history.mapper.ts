import {SocialMediaEnum} from "../types/social-media.types";
import {ICampaignAction, IInfluencerHistory, IInvoiceAction, InfluencerHistoryActionType} from "../types/history.types";
import {
    AdminInfActionsHistoryDto,
    AdminInfCampaignActionDto,
    AdminInfInvoiceActionDto
} from "../../modules/admin/dto/histories/admin-inf-history.dto";
import {
    HistoryCampaignActionStatus,
    HistoryCampaignActionStatusLabel,
    ShortSocialAccountInfo
} from "../types/influencer/influencer.types";
import {formatDateTime} from "../utils/formatters";

function isCampaignAction(
    action: ICampaignAction | IInvoiceAction,
): action is ICampaignAction {
    return action.type === InfluencerHistoryActionType.campaign;
}

function isInvoiceAction(
    action: ICampaignAction | IInvoiceAction,
): action is IInvoiceAction {
    return action.type === InfluencerHistoryActionType.invoice;
}

function mapCampaignActionToDto(
    action: ICampaignAction,
): AdminInfCampaignActionDto {
    return {
        actionType: action.type,
        dateAndTime: formatDateTime(action.date),
        socialMedia: action.socialMedia,
        username: action.username,
        campaignName: action.campaignName,
        reward: action.reward,
        status: action.actionNumber as HistoryCampaignActionStatus,
        statusLabel:
            HistoryCampaignActionStatusLabel[
                action.actionNumber as HistoryCampaignActionStatus
                ],
        currentBalance: action.currentBalance,
        isStillInCampaign: action.isStillInCampaign,
    };
}

function mapInvoiceActionToDto(
    action: IInvoiceAction,
): AdminInfInvoiceActionDto {
    return {
        actionType: action.type,
        invoiceId: action.invoiceId.toString(),
        amount: action.amount,
        paymentMethod: action.paymentMethod,
        currentBalance: action.currentBalance,
        date: formatDateTime(action.date),
    };
}

// Map IInfluencerHistory to AdminInfActionsHistoryDto
export const mapInfHistoryToAdminHistoryDto = (
    history: IInfluencerHistory,
    influencerName: string,
    accounts: ShortSocialAccountInfo[],
    currencyNote?: string,
): AdminInfActionsHistoryDto => {
    return {
        influencerName,
        actions: history.actions.map((action) => {
            if (isCampaignAction(action)) {
                return mapCampaignActionToDto(action);
            }

            if (isInvoiceAction(action)) {
                return mapInvoiceActionToDto(action);
            }

            throw new Error("Unknown influencer history action type");
        }),
        accounts,
        currencyNote,
    };
};
