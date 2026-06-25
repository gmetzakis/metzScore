/**
 * API Service - Handles all backend communication
 * Keeps API endpoints abstracted from React components
 */

const API_BASE_URL = "http://localhost:8000/api";

export const apiService = {
  /**
   * Get all live football matches
   */
  getLiveFootballMatches: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/football/matches/live`);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching live matches:", error);
      throw error;
    }
  },

  /**
   * Get all football matches (live and upcoming)
   */
  getAllFootballMatches: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/football/matches/all`);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching upcoming matches:", error);
      throw error;
    }
  },

  /**
   * Get the full detail payload for a single match by event id.
   * Use the id returned in the matches list.
   */
  getMatchDetail: async (matchId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/football/matches/${matchId}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching match detail:", error);
      throw error;
    }
  },

  /**
   * Get the detailed Stoiximan statsstream payload for a single match.
   */
  getStatsstreamDetailed: async (matchId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/football/statsstream/detailed/${matchId}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching statsstream detailed data:", error);
      throw error;
    }
  },
};
