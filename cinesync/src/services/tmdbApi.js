const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_API_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

export const tmdbApi = {
    async get(endpoint, params = {}) {
        const urlParams = new URLSearchParams({
            api_key: TMDB_API_KEY,
            language: 'pt-BR',
            ...params,
        });
        const url = `${TMDB_API_URL}/${endpoint}?${urlParams}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`API Error: ${res.statusText}`);
                throw new Error('Falha ao buscar dados do TMDb.');
            }
            return await res.json();
        } catch (error) {
            console.error('Erro na chamada da API TMDb:', error);
            throw error;
        }
    },
    discoverContent(mediaType, providerId, page = 1, genreId = null, sortBy = 'popularity.desc') {
        const params = {
            sort_by: sortBy,
            watch_region: 'BR',
            with_watch_providers: providerId,
            page,
        };
        if (genreId) {
            params.with_genres = genreId;
        }
        return this.get(`discover/${mediaType}`, params);
    },
    getGenres(mediaType) {
        return this.get(`genre/${mediaType}/list`);
    },
    getDetails(mediaType, id) {
        return this.get(`${mediaType}/${id}`, { append_to_response: 'watch/providers' });
    }
};