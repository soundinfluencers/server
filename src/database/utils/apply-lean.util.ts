import {RepoOptions} from "../types/repo.types";

// Хэлпер для запросов к MongoDB (устанавливает значение lean к ним для получения чистого ответа)
export function applyLean(query: any, options?: RepoOptions) {
    const isLean = options?.lean ?? true;
    return isLean ? query.lean() : query;
}