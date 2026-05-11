export const getSession   = () => { try{ return JSON.parse(localStorage.getItem("asist_session"))||null; }catch{ return null; } };
export const setSession   = (u) => localStorage.setItem("asist_session", JSON.stringify(u));
export const clearSession = ()  => localStorage.removeItem("asist_session");
