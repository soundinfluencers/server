import {Client} from "../../database/schemas/users/client.schema";
import {ClientAccountDetailsDto} from "../../modules/profile/dto/influencer/get-profile.dto";

// Maps client doc to client account details dto
export const mapClientToAccountDetailsDto = (client: Client): ClientAccountDetailsDto => {
    return {
        firstName: client.firstName,
        companyName: client.company,
        email: client.email,
        phone: client.phone,
    }
};