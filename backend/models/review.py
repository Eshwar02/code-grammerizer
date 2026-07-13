from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    review_score = Column(Float, nullable=True)
    summary = Column(Text, nullable=True)
    static_analysis = Column(JSON, nullable=True)
    complexity_metrics = Column(JSON, nullable=True)
    ai_review = Column(JSON, nullable=True)
    documentation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="reviews")
    findings = relationship("ReviewFinding", back_populates="review", cascade="all, delete-orphan")


class ReviewFinding(Base):
    __tablename__ = "review_findings"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False)
    severity = Column(String, nullable=False)  # "high", "medium", "low", "info"
    category = Column(String, nullable=False)  # "bug", "security", "style", "performance"
    issue = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    suggestion = Column(Text, nullable=True)
    file_name = Column(String, nullable=True)
    line_number = Column(Integer, nullable=True)

    review = relationship("Review", back_populates="findings")
