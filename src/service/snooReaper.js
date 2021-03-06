const
    Snoowrap = require('../config/snoo-config').Snoowrap,
    Snoostorm = require('snoostorm'),
    storm_requester = require('../config/snoo-config').requester,
    config = require('../config/snoo-config').config,
    identifier = require('../config/snoo-config').identifier,
    colors = require('colors'),
    dateFormat = require('dateformat'),
    incrementScore = require('../util/scoreIncrementUtil')



// Please don't use this disgusting mess! There was a problem with Snoostorm that required the use of multiple requesters
// This has been fixed in the update tree https://github.com/web-temps/r-PlayingCardsMarketBot/tree/update
// Please use that version instead.

// Submission Requester
const submissionRequester = new Snoowrap(identifier);
submissionRequester.config(config);

// Flair Assign Requester
const flairAssignRequester = new Snoowrap(identifier);
flairAssignRequester.config(config)

// Comment Requester
const commentRequester = new Snoowrap(identifier);
commentRequester.config(config)

// Save Comment Requester
const saveRequester = new Snoowrap(identifier);
saveRequester.config(config)

// Reply to Comment Requester
const replyRequester = new Snoowrap(identifier);
replyRequester.config(config)

// Parent Comment Requester
const parentCommentRequester = new Snoowrap(identifier);
parentCommentRequester.config(config)

const MASTER_SUB = process.env.MASTER_SUB




// 1. Get Stream from Inbox of mentions
const checkMentions = function () {
    const inbox = new Snoostorm.InboxStream(storm_requester)

    inbox.on('item', function (item) {

        commentRequester.getComment(item.id).fetch().then(function (comment) {


            if (comment.saved === true) {

            }
            if (comment.saved === false) {
                utc = item.created_utc
                formattedUTC = dateFormat(new Date())
                console.log((`\n------------${formattedUTC}-----------------\n`).blue)
                console.log('new request!'.yellow)
                processItem(item)

            }


        })

    })

}

// If item was not saved, process.
const processItem = function (item) {
    console.log('processing item...'.magenta)


    mentionFromUser = item.author.name


    // For Each Mention Received:
    // Mention Must be from MASTER_SUB
    if (item.subreddit_name_prefixed === 'r/' + MASTER_SUB && item.parent_id != null) {






        topLevelComment = checkTopLevel(item.parent_id)
        // Find the parent_id of the Submission the Comment came from
        parent_id = getParentId(item.parent_id)




        console.log(('received mention from u/' + mentionFromUser).green)
        console.log((`'` + item.body + `'`).grey)
        // Get the Submission and retreive its author
        let submissionAuthor;



        if (topLevelComment) {
            console.log('was a top level comment. fetching the submission'.magenta)

            // if parent id was from a top level comment, get the submission it was from
            submissionRequester.getSubmission(parent_id).fetch().then(function (submission) {
                submissionAuthor = submission.author.name

                // check mentionfromuser vs submissionauthor
                if (submissionAuthor == mentionFromUser) {
                    console.log(`u/${mentionFromUser} attempted to cast vote on self!`.red)
                    replyToSender(item.id, `Nice try, but you can't vote on yourself!`)
                    saveItem(saveRequester, item.id)
                } else {
                    console.log(('referencing submision by user: u/' + submissionAuthor).grey)
                    assignFlairs(flairAssignRequester, item.body, submissionAuthor, item.id)
                    saveItem(saveRequester, item.id)
                }


            })

        } else if (!topLevelComment) {

            console.log('was a reply to a comment. fetching the comment.'.magenta)
            // If parent ID was from another comment, fetch it.
            commentRequester.getComment(parent_id).fetch().then(function (submission) {


                submissionAuthor = submission.author.name

                if (submissionAuthor == mentionFromUser) {
                    console.log(`u/${mentionFromUser} attempted to cast vote on self!`.red)
                    replyToSender(item.id, `Nice try, but you can't vote on yourself!`)
                    saveItem(saveRequester, item.id)
                } else {
                    console.log(('referencing comment by user: u/' + submissionAuthor).grey)
                    assignFlairs(flairAssignRequester, item.body, submissionAuthor, item.id)
                    saveItem(saveRequester, item.id)
                }

            })
        }





    } else {
        console.log('Attempted request from unauthorized sub.')

    }

}

const checkTopLevel = function (str) {
    const regexP = RegExp(/^t3_/)


    if (regexP.test(str)) {

        return true;
    } else {

        return false;
    }

}

// 1.A. Return the parent id with the prefix removed
const getParentId = function (str) {

    return str.split('_')[1];
}


// 2. Assign Flairs
const assignFlairs = function (requester, body, submissionAuthor, itemId) {


    message = 'Thanks for your input! Your vote has been accounted for.'
    mentionBody = body.toLowerCase()
    console.log('assigning flairs...'.magenta)

    let authorsFlair = String
    // Get the user and their flair
    requester.getSubreddit(MASTER_SUB).getUserFlair(submissionAuthor).then(function (userFlair) {

        flair = userFlair.flair_text


        if (flair == undefined | flair == '') { // if it is undefined, set it to 0 0 0
            authorsFlair = 'Positive: 0 Neutral: 0 Negative: 0'
        } else {
            authorsFlair = flair
        }

        // [Increment Positive]
        if (mentionBody.includes('!positive')) {
            console.log(`incrementing postive flair count on u/${submissionAuthor}`.green)
            // Assign a flair to the author

            newFlair = incrementScore.incrementPositiveCount(authorsFlair)

            requester.getUser(submissionAuthor).assignFlair({
                subredditName: MASTER_SUB,
                text: newFlair,
                cssClass: process.env.FLAIR_CSS_CLASS
            })
            console.log((`u/${submissionAuthor}'s new flair: `  + newFlair).green)

        }

        // [Increment Negative]
        if (mentionBody.includes('!negative')) {
            console.log(`incrementing negative count on u/${submissionAuthor}`.red)

            newFlair = incrementScore.incrementNegativeCount(authorsFlair)
            requester.getUser(submissionAuthor).assignFlair({
                subredditName: MASTER_SUB,
                text: newFlair,
                cssClass: process.env.FLAIR_CSS_CLASS
            })
            console.log((`u/${submissionAuthor}'s new flair: ` + newFlair).green)
        }
        // [Increment Neutral]
        if (mentionBody.includes('!neutral')) {
            console.log(`incrementing neutral count on u/${submissionAuthor}`.white)

            newFlair = incrementScore.incrementNeutralCount(authorsFlair)
            requester.getUser(submissionAuthor).assignFlair({
                subredditName: MASTER_SUB,
                text: newFlair,
                cssClass: process.env.FLAIR_CSS_CLASS
            })
            console.log((`u/${submissionAuthor}'s new flair: `  + newFlair).green)
        } else if (!mentionBody.includes('!positive') && !mentionBody.includes('!neutral') && !mentionBody.includes('!negative')) {
            message = `You need to give me a direction!  
            
            To cast your vote successfully:  
            
            u/${process.env.REDDIT_USER} !positive
            u/${process.env.REDDIT_USER} !neutral
            u/${process.env.REDDIT_USER} !negative`
            console.log(`u/${mentionFromUser} did not call me with a directive!`.red)
        }

        replyToSender(itemId, message)


    })
}

const replyToSender = function (itemId, message) {
    replyRequester.getComment(itemId).reply(message)

}


// Save the item to not reapply changes.
const saveItem = function (requester, itemId) {
    requester.getComment(itemId).save()


}



module.exports = {
    checkMentions: checkMentions
}
