import {Types} from "mongoose";

export type ObjId = Types.ObjectId;
export const ObjId = Types.ObjectId;

// safe parse to ObjectId
export const toObjIdSafe = (id?: string | null): ObjId | null => {
    return Types.ObjectId.isValid(id ?? '') ? new Types.ObjectId(id) : null;
};