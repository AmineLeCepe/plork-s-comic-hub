const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 10);
const MAX_PAGES = Number(process.env.MAX_PAGES || 100);
const PAGE_PROCESS_CONCURRENCY = Number(process.env.PAGE_PROCESS_CONCURRENCY || 3);

module.exports = {
    MAX_UPLOAD_MB,
    MAX_PAGES,
    PAGE_PROCESS_CONCURRENCY,
};