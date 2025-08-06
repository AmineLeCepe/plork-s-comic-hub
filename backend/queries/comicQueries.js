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
    }
};

module.exports = comicQueries;