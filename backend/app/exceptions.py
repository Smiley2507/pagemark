class NeedsClarificationException(Exception):
    """Raised when the AI identifies that it needs more context from the user to proceed."""
    def __init__(self, question: str, section_id: int):
        self.question = question
        self.section_id = section_id
        super().__init__(f"Clarification needed for section {section_id}: {question}")
