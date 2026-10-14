import { configure } from '@testing-library/react'

// Lazy-loaded tabs are imported on first use; on a busy machine (parallel test files, CI) that can take longer
// than the 1 second default for findBy and waitFor, which made a passing test fail now and then.
configure({ asyncUtilTimeout: 5000 })
