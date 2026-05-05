export function shouldShowConversationStarters(readyMatchCount: number) {
  return readyMatchCount < 3;
}

export function conversationStartersIntro(readyMatchCount: number) {
  if (readyMatchCount === 0) {
    return "No ready matches yet. These prompts can help the group find something close.";
  }

  return "Only a few ready matches. These prompts can help uncover another option.";
}
