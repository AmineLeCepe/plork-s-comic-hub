const { Comic } = require('../models');

const comicQueries = {
    addComic: async (comicData) => {
        try {
            const newComic = new Comic(comicData);
            await newComic.save();
            return { success: true, comic: newComic };
        } catch (error) {
            console.error("Error adding comic:", error);
            // Provide a more specific error message if possible
            const errorMessage = error.message.includes('duplicate key')
                ? 'A comic with this title already exists.'
                : 'An unexpected error occurred while creating the comic.';
            return { success: false, error: errorMessage };
        }
    },

    getComicsByAuthor: async (authorId) => {
        try {
            // Find all comics where the author field matches the user's ID
            // Sort by the newest comics first
            const comics = await Comic.find({ author: authorId }).sort({ createdAt: -1 });
            return { success: true, comics };
        } catch (error) {
            console.error("Error fetching comics by author:", error);
            return { success: false, error: "An unexpected error occurred while fetching comics." };
        }
    }
};

module.exports = comicQueries;