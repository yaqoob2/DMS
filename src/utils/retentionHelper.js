const isWithinRetentionWindow = (deletedAt, days = 30) => {
    if (!deletedAt) return false;
    
    const now = new Date();
    const deletedDate = new Date(deletedAt);
    const diffTime = Math.abs(now - deletedDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= days;
};

module.exports = { isWithinRetentionWindow };
