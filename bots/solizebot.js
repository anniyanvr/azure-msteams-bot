const Recognizers = require('@microsoft/recognizers-text-suite');
const { ActionTypes, ActivityTypes, ActivityHandler, MessageFactory, CardFactory } = require('botbuilder');
const { ChoiceFactory } = require('botbuilder-choices'); 
const path = require('path');
const fs = require('fs');
const axios = require('axios');
// The accessor names for the conversation flow and user profile state property accessors.
const CONVERSATION_FLOW_PROPERTY = 'CONVERSATION_FLOW_PROPERTY';
const USER_PROFILE_PROPERTY = 'USER_PROFILE_PROPERTY'; 
// Identifies the last question asked.
const question = {
	name: 'name',
	email: 'email',
	qa1: 'qa1',
	qa11: 'qa11',
	qa2: 'qa2',
	qa3: 'qa3',
	qa311: 'qa311',
	qa312: 'qa312',
	qa313: 'qa313',
	qa321: 'qa321',
	qa322: 'qa322',
	qa323: 'qa323',
	qa4: 'qa4',
	qa5: 'qa5',
	qa6: 'qa6',
	qa7: 'qa7',
	qa8: 'qa8',
	upload: 'upload',
    none: 'none'
};

let questions='';
let uploadResponse = false;
// Defines a bot for filling a user profile.
class CustomPromptBot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();
        // The state property accessors for conversation flow and user profile.
        this.conversationFlow = conversationState.createProperty(CONVERSATION_FLOW_PROPERTY);
        this.userProfile = userState.createProperty(USER_PROFILE_PROPERTY);
		let rawdata = fs.readFileSync(path.join(__dirname, 'qa.json'), 'UTF-8');
		//let rawdata = fs.readFileSync('/home/devops/repo/ms-bot/freshbot/bots/qa.json', 'UTF-8');
		questions = JSON.parse(rawdata);
		console.log(questions); 
        this.onMembersAdded(async (context, next) => {
            // Iterate over all new members added to the conversation
            for (const idx in context.activity.membersAdded) {
                if (context.activity.membersAdded[idx].id !== context.activity.recipient.id) {
                    await context.sendActivity('Hi! This is SOLIZE assistant bot.');
                    await context.sendActivity("We assist you in fast staffing placements.");
                    await context.sendActivity('Please tell us your name.');  
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
        // The state management objects for the conversation and user.
        this.conversationState = conversationState;
        this.userState = userState;
        this.onMessage(async (turnContext, next) => {
            const flow = await this.conversationFlow.get(turnContext, { lastQuestionAsked: question.name });
            const profile = await this.userProfile.get(turnContext, {}); 
			//flow.lastQuestionAsked = question.name;
            await CustomPromptBot.fillOutUserProfile(flow, profile, turnContext);  
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context); 
        // Save any state changes. The load happened during the execution of the Dialog.
        await this.conversationState.saveChanges(context, false);
        await this.userState.saveChanges(context, false);
    }

    // Manages the conversation flow for filling out the user's profile.
    static async fillOutUserProfile(flow, profile, turnContext) {
		if (flow.lastQuestionAsked == "upload" && turnContext.activity.attachments && turnContext.activity.attachments.length > 0) {
			// The user sent an attachment and the bot should handle the incoming attachment.
			console.log(turnContext.activity.attachments.length);
			try {
				await this.handleIncomingAttachment(turnContext);
				console.log("uploadResponse >> " + uploadResponse);
				if(!uploadResponse){
					await turnContext.sendActivity("Upload file size < 2mb");
					flow.lastQuestionAsked = question.upload;
				}else{
					await turnContext.sendActivity("Thanks! We will look into the job description.");
					await this.sendSuggestedActions(turnContext, 'qa4',questions);
					flow.lastQuestionAsked = question.qa4; 
				}
			} catch(err){
				await turnContext.sendActivity("Upload file size < 2mb");
				flow.lastQuestionAsked = question.upload;
			}
        }  else {
			const input = turnContext.activity.text;
			console.log("user input >> " + input);
			console.log("flow.lastQuestionAsked >> " + flow.lastQuestionAsked);		
			let result;
			switch (flow.lastQuestionAsked) {
			// If we're just starting off, we haven't asked the user for any information yet.
			// Ask the user for their name and update the conversation flag.
			case question.none:
				result = input; 
				profile={};
				await turnContext.sendActivity('Hi! This is SOLIZE assistant bot.');
                await turnContext.sendActivity("We assist you in fast staffing placements.");
                await turnContext.sendActivity('Please tell us your name.');
				//flow.lastQuestionAsked = question.name;
				break;
				
			case question.name:
				result = this.validateName(input);
				if (result.success) {
					profile.name=result.name;
					await turnContext.sendActivity(`Thanks ${ profile.name }! Please tell us your email address and/or phone number?`);
					flow.lastQuestionAsked = question.email;
					console.log("flow.lastQuestionAsked >>>>>>>> " + flow.lastQuestionAsked);
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					break;
				}
				break;
				
			case question.email:
				result = this.doValidate(input);
				if (result.success) {
					profile.email = result.name;
					//await turnContext.sendActivity(`I have your email as ${ profile.email }.`);
					await turnContext.sendActivity('Thanks');
					await turnContext.sendActivity("OK! Before we get you started, here are few rules.If you wish to start from the beginning, type 'Start'." +
					"If you wish to end session, type 'End'. Don't forget, there's always an option to call our SOLIZE agent if you would like to talk directly.'");
					await this.sendSuggestedActions(turnContext, 'qa1',questions);
					flow.lastQuestionAsked = question.qa1;
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					break;
				}

			case question.qa1:
				result = this.checkOptions(input,questions['qa1'].suggestion);
				if (result.success) { 
					profile.qa1 = result.name;
					if(result.name != "Other") {
						await this.sendSuggestedActions(turnContext, 'qa2',questions);
						flow.lastQuestionAsked = question.qa2;
					}else{
						await this.sendSuggestedActions(turnContext, 'qa11',questions);
						flow.lastQuestionAsked = question.qa11;
					}
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa1',questions);
					flow.lastQuestionAsked = question.qa1;
					break;
				}
			case question.qa11:
				result = this.checkOptions(input,questions['qa11'].suggestion);
				if (result.success) {
					profile.qa11 = result.name;
					if(result.name == "Yes"){
					//68
						await this.sendSuggestedActions(turnContext, 'qa4',questions);
						flow.lastQuestionAsked = question.qa4; 
					}else{
					//73
						await turnContext.sendActivity("Are there anything else we can assist you today? If you wish to start from the beginning, type 'Start'. If you wish to end session, type 'End'. Don't forget, there's always an option to call our SOLIZE agent if you would like to talk directly.");
						flow.lastQuestionAsked = question.qa8;
					}
					break;
				} else  {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					//if(profile.qa1 != "Other") {
					//	await this.sendSuggestedActions(turnContext, 'qa2',questions);
					//	flow.lastQuestionAsked = question.qa2;
					//}else{
						await this.sendSuggestedActions(turnContext, 'qa11',questions);
						flow.lastQuestionAsked = question.qa11;
					//}
					break;
				}	
			case question.qa2:
				result = this.checkOptions(input,questions['qa2'].suggestion);
				if (result.success) {
					profile.qa2 = result.name;
					if(result.name == "No"){
						await this.sendSuggestedActions(turnContext, 'qa3',questions);
						flow.lastQuestionAsked = question.qa3; 
					}else{
						await turnContext.sendActivity("Great! You can either upload the document or you can type in the job description.");
						flow.lastQuestionAsked = question.upload; 
					}
					break;
				} else  {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa2',questions);
					flow.lastQuestionAsked = question.qa2;
					break;
				}
			case question.qa3:
				result = this.checkOptions(input,questions['qa3'].suggestion);
				if (result.success) {
					profile.qa3 = result.name;
					if(result.name == "Mechanical engineer") {
						await this.sendSuggestedActions(turnContext, 'qa311',questions);
						flow.lastQuestionAsked = question.qa311;
					}else if(result.name == "IT engineer"){
						await this.sendSuggestedActions(turnContext, 'qa321',questions);
						flow.lastQuestionAsked = question.qa321;
					} else {
						await turnContext.sendActivity("Thank you for your interest in SOLIZE. Our SOLIZE agent would like to contact you directly within 2 days to serve your needs.");
						//68
						await this.sendSuggestedActions(turnContext, 'qa4',questions);
						flow.lastQuestionAsked = question.qa4; 
					}
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa3',questions);
					flow.lastQuestionAsked = question.qa3;
					break;
				}
			case question.qa311:
				result = this.checkOptions(input,questions['qa311'].suggestion);
				if (result.success) {
					profile.qa311 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa312',questions);
					flow.lastQuestionAsked = question.qa312; 
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa311',questions);
					flow.lastQuestionAsked = question.qa311;
					break;
				}
			case question.qa312:
				result = this.checkOptions(input,questions['qa312'].suggestion);
				if (result.success) {
					profile.qa312 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa313',questions);
					flow.lastQuestionAsked = question.qa313; 
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa312',questions);
					flow.lastQuestionAsked = question.qa312; 
					break;
				}
			case question.qa313:
				result = this.checkOptions(input,questions['qa313'].suggestion);
				if (result.success) {
					profile.qa313 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa4',questions);
					flow.lastQuestionAsked = question.qa4; 
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa313',questions);
					flow.lastQuestionAsked = question.qa313;
					break;
				}
			case question.qa321:
				result = this.checkOptions(input,questions['qa321'].suggestion);
				if (result.success) {
					profile.qa321 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa322',questions);
					flow.lastQuestionAsked = question.qa322; 
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa321',questions);
					flow.lastQuestionAsked = question.qa321;
					break;
				}
			case question.qa322:
				result = this.checkOptions(input,questions['qa322'].suggestion);
				if (result.success) {
					profile.qa322 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa323',questions);
					flow.lastQuestionAsked = question.qa323; 
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa322',questions);
					flow.lastQuestionAsked = question.qa322; 
					break;
				}
			case question.qa323:
				result = this.checkOptions(input,questions['qa323'].suggestion);
				if (result.success) {
					profile.qa323 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa4',questions);
					flow.lastQuestionAsked = question.qa4; 
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa323',questions);
					flow.lastQuestionAsked = question.qa323; 
					break;
				}
			case question.qa4:
				result = this.validateText(input);
				if (result.success) {
					profile.qa4 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa5',questions);
					flow.lastQuestionAsked = question.qa5;
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa4',questions);
					flow.lastQuestionAsked = question.qa4; 
					break;
				}
			case question.qa5:
				result = this.checkOptions(input,questions['qa5'].suggestion);
				if (result.success) {
					profile.qa5 = result.name;
					await this.sendSuggestedActions(turnContext, 'qa6',questions);
					flow.lastQuestionAsked = question.qa6;
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa5',questions);
					flow.lastQuestionAsked = question.qa5;
					break;
				}
			case question.qa6:
				result = this.validateText(input);
				if (result.success) {
					profile.qa6 = result.name;
					await turnContext.sendActivity("OK! That's all the questions. We'll look into the information you have provided, and our SOLIZE agent will contact you shortly.");
					await turnContext.sendActivity("Do you have any preference on Date and Time for our agent to contact you? (ex. dd-mm-yyyy - 01-01-1900)");
					flow.lastQuestionAsked = question.qa7;
					//profile = {};
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					await this.sendSuggestedActions(turnContext, 'qa6',questions);
					flow.lastQuestionAsked = question.qa6;
					break;
				}
			case question.qa7:
				result = this.validateDate(input);
				if (result.success) {
					profile.qa7 = result.name;
					await turnContext.sendActivity("Are there anything else we can assist you today? If you wish to start from the beginning, type 'Start'. If you wish to end session, type 'End'. Don't forget, there's always an option to call our SOLIZE agent if you would like to talk directly.");
					flow.lastQuestionAsked = question.qa8;
					//profile = {};
					break;
				} else {
					// If we couldn't interpret their input, ask them for it again.
					// Don't update the conversation flag, so that we repeat this step.
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					break;
				}
			case question.qa8:
				result = this.validateName(input);
				if (result.success) {
					profile.qa8 = result.name;
					if(result.name == "Start"){
						flow.lastQuestionAsked = question.none;
						console.log(profile);
						profile = {};
					}else if(result.name == "End"){
						flow.lastQuestionAsked = question.none;
						await turnContext.sendActivity(`OK! Thank you ${ profile.name }. Have a great day!`);
						console.log(profile);
						profile = {};
					}else{
						await turnContext.sendActivity("Are there anything else we can assist you today? If you wish to start from the beginning, type 'Start'. If you wish to end session, type 'End'. Don't forget, there's always an option to call our SOLIZE agent if you would like to talk directly.");
						flow.lastQuestionAsked = question.qa8;
					}
					break;
				} else {
					await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
					break;
				}
			}
		}
    }

	/**
     * Send suggested actions to the user.
     * @param {TurnContext} turnContext A TurnContext instance containing all the data needed for processing this conversation turn.
     */
    static async sendSuggestedActions(turnContext, type, questions) {
		console.log(questions);
		console.log(questions[type])
        //var reply = MessageFactory.suggestedActions(questions[type].suggestion, questions[type].question);
		//var reply = ChoiceFactory.heroCard(questions[type].suggestion, questions[type].question);
		const buttons = [
            {type: ActionTypes.ImBack, title: '1. Inline Attachment', value: '1'},
            {type: ActionTypes.ImBack, title: '2. Internet Attachment', value: '2'},
            {type: ActionTypes.ImBack, title: '3. Uploaded Attachment', value: '3'}
        ];
        const card = CardFactory.heroCard('', undefined,
            buttons, {text: 'You can upload an image or select one of the following choices.'});
        const reply = {type: ActivityTypes.Message, attachments: [card]};
		await turnContext.sendActivity(reply);
    }
	
	/**
     * Downloads attachment to the disk.
     * @param {Object} attachment
     */
    static async downloadAttachmentAndWrite(attachment) {
        // Retrieve the attachment via the attachment's contentUrl.
		console.log("attachment.contentUrl>>" + attachment.contentUrl);
        const url = attachment.contentUrl;

        // Local file path for the bot to save the attachment.
        const localFileName = path.join(__dirname, attachment.name);

        try {
            // arraybuffer is necessary for images
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            // If user uploads JSON file, this prevents it from being written as "{"type":"Buffer","data":[123,13,10,32,32,34,108..."
            if (response.headers['content-type'] === 'application/json') {
                response.data = JSON.parse(response.data, (key, value) => {
                    return value && value.type === 'Buffer' ? Buffer.from(value.data) : value;
                });
            }
			//console.log("response.data >>>>> " + response.data);
            fs.writeFileSync(localFileName, response.data);/*, (fsError) => {
                if (fsError) {
                    throw fsError;
                }
            });*/
			uploadResponse=true;
			let stats = fs.statSync(localFileName);
			console.log("stats >>>>> " + stats);
			let fileSizeInBytes = stats['size'];
			console.log("fileSizeInBytes >>>>> " + fileSizeInBytes);
			if(fileSizeInBytes > 2097152){
			  console.log("Size > 2mb");
			  uploadResponse=false;
			  return undefined;
			}
        } catch (error) {
            console.error(error);
            return undefined;
        }
        // If no error was thrown while writing to disk, return the attachment's name
        // and localFilePath for the response back to the user.
        return {
            fileName: attachment.name,
            localPath: localFileName
        };
    }
	
	/**
     * Saves incoming attachments to disk by calling `this.downloadAttachmentAndWrite()` and
     * responds to the user with information about the saved attachment or an error.
     * @param {Object} turnContext
     */
    static async handleIncomingAttachment(turnContext) {
        // Prepare Promises to download each attachment and then execute each Promise.
        const promises = turnContext.activity.attachments.map(this.downloadAttachmentAndWrite);
        const successfulSaves = await Promise.all(promises);

        // Replies back to the user with information about where the attachment is stored on the bot's server,
        // and what the name of the saved file is.
        async function replyForReceivedAttachments(localAttachmentData) {
            if (localAttachmentData) {
                // Because the TurnContext was bound to this function, the bot can call
                // `TurnContext.sendActivity` via `this.sendActivity`;
                //await this.sendActivity(`Attachment "${ localAttachmentData.fileName }" ` +
                  //  `has been received and saved to "${ localAttachmentData.localPath }".`);
            } else {
                //await this.sendActivity('Attachment was not successfully saved to disk.');
            }
        }

        // Prepare Promises to reply to the user with information about saved attachments.
        // The current TurnContext is bound so `replyForReceivedAttachments` can also send replies.
        const replyPromises = successfulSaves.map(replyForReceivedAttachments.bind(turnContext));
        await Promise.all(replyPromises);
    }
	
	static validateText(input) {
        const name = input && input.trim();
        return name !== undefined
            ? { success: true, name: name }
            : { success: false, message: 'Please enter a name that contains at least one character.' };
    };
	
    // Validates name input. Returns whether validation succeeded and either the parsed and normalized
    // value or a message the bot can use to ask the user again.
    static validateName(input) {
        const name = input && input.trim();
		var result = this.allLetter(name);
		console.log(result);
        return result;
    };
	
	static allLetter(name) {
		var letters = /^[a-zA-Z]*$/g;
		return !letters.test(name)? { success: false, message: 'Please enter a name that contains only character.' }:{ success: true, name: name };
	};
	
	static validateEmail(email) { //Validates the email address
		var emailRegex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
		return emailRegex.test(email);
	};

	static validatePhone(phone) { //Validates the phone number
		var phoneRegex = /^(\+91-|\+91|0)?\d{10}$/; // Change this regex based on requirement
		return phoneRegex.test(phone);
	};
	
	static doValidate(input) {
		console.log("this.validateEmail(input) >>> " + this.validateEmail(input));
		console.log("this.validatePhone(input) >>> " + this.validatePhone(input));
		console.log("(this.validateEmail(input) || this.validatePhone(input))>> " + (this.validateEmail(input) || this.validatePhone(input)));
	   return (this.validateEmail(input) || this.validatePhone(input))? { success: true, name: input }:{ success: false, message: 'Please enter valid email or mobile number.' };
	};

	static checkOptions(input, options) { 
		return !options.includes(input)? { success: false, message: 'Please select the options only.' }:{ success: true, name: input };
	};
    
    // Validates date input. Returns whether validation succeeded and either the parsed and normalized
    // value or a message the bot can use to ask the user again.
    static validateDate(input) {
        // Try to recognize the input as a date-time. This works for responses such as "11/14/2018", "today at 9pm", "tomorrow", "Sunday at 5pm", and so on.
        // The recognizer returns a list of potential recognition results, if any.
        try {
            const results = Recognizers.recognizeDateTime(input, Recognizers.Culture.English);
            const now = new Date();
            const earliest = now.getTime() + (60 * 60 * 1000);
            let output;
            results.forEach(result => {
                // result.resolution is a dictionary, where the "values" entry contains the processed input.
                result.resolution.values.forEach(resolution => {
                    // The processed input contains a "value" entry if it is a date-time value, or "start" and
                    // "end" entries if it is a date-time range.
                    const datevalue = resolution.value || resolution.start;
                    // If only time is given, assume it's for today.
                    const datetime = resolution.type === 'time'
                        ? new Date(`${ now.toLocaleDateString() } ${ datevalue }`)
                        : new Date(datevalue);
                    if (datetime && earliest < datetime.getTime()) {
                        output = { success: true, date: datetime.toLocaleDateString() };
                        return;
                    }
                });
            });
            return output || { success: false, message: "I'm sorry, please enter a date at least an hour out." };
        } catch (error) {
            return {
                success: false,
                message: "I'm sorry, I could not interpret that as an appropriate date. Please enter a date at least an hour out."
            };
        }
    }
}

module.exports.CustomPromptBot = CustomPromptBot;
