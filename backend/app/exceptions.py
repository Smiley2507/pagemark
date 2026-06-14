class NeedsClarificationException(Exception):
    """Raised when the AI identifies that it needs more context from the user to proceed."""
    def __init__(self, question: str, section_id: int, action: str = "ask_user"):
        self.question = question
        self.section_id = section_id
        self.action = action
        super().__init__(f"Clarification needed for section {section_id}: {question}")
