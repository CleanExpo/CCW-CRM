# BDD Scenario Template - Layer 5
# Acceptance criteria in Gherkin format

Feature: [Feature Name]
  As a [persona]
  I want to [action]
  So that [benefit]

  Background:
    Given I am a [persona type]
    And I am on the [starting point]

  # ===== HAPPY PATH =====
  @happy-path @journey:journey-id @step:step-1
  Scenario: Successfully complete [action]
    Given I have [preconditions]
    When I [action 1]
    And I [action 2]
    Then I should see [expected result]
    And I should feel [target emotion]

  @happy-path @journey:journey-id @step:step-2
  Scenario: Progress to next step
    Given I have completed step-1
    When I [trigger action]
    Then I should be on [next step]
    And I should see [confirmation]

  # ===== ERROR HANDLING =====
  @error @journey:journey-id
  Scenario: Handle invalid input gracefully
    Given I am on [form step]
    When I enter invalid [field]
    Then I should see a helpful error message
    And the error should explain how to fix it
    And I should NOT feel embarrassed

  @error @journey:journey-id
  Scenario: Recover from network failure
    Given I am submitting [form]
    When the network fails
    Then my progress should be saved
    And I should see a retry option
    And I should NOT lose my data

  # ===== EDGE CASES =====
  @edge-case @journey:journey-id
  Scenario: Handle empty state
    Given I have no [items]
    When I view the [page]
    Then I should see helpful empty state
    And I should see a clear call to action

  @edge-case @journey:journey-id
  Scenario: Handle partial completion
    Given I started but didn't finish [action]
    When I return to the app
    Then I should see my saved progress
    And I should be able to continue

  # ===== ACCESSIBILITY =====
  @a11y @journey:journey-id
  Scenario: Complete journey with keyboard only
    Given I am using keyboard navigation
    When I complete [journey]
    Then all interactive elements should be reachable
    And focus should be visible at all times

  @a11y @journey:journey-id
  Scenario: Complete journey with screen reader
    Given I am using a screen reader
    When I complete [journey]
    Then all content should be announced
    And the flow should be logical
